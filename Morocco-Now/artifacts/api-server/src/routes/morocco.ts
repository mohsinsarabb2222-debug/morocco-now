import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  businessesTable,
  categoriesTable,
  citiesTable,
  contactMessagesTable,
  destinationsTable,
  favoritesTable,
  localUsersTable,
  plansTable,
  productsTable,
  reviewsTable,
  servicesTable,
  subscriptionsTable,
} from "@workspace/db";
import {
  AddFavoriteParams,
  AddFavoriteResponse,
  AskMoroccoAiResponse,
  AskMoroccoAiBody,
  ContactMessage,
  CreateReviewBody,
  CreateReviewResponse,
  CreateSubscriptionBody,
  CreateSubscriptionResponse,
  GetBusinessParams,
  GetBusinessResponse,
  GetHomeResponse,
  GetProfileResponse,
  ListBusinessReviewsParams,
  ListBusinessReviewsResponse,
  ListBusinessesQueryParams,
  ListBusinessesResponse,
  ListCategoriesResponse,
  ListCitiesResponse,
  ListDestinationsResponse,
  ListFavoritesResponse,
  ListMapMarkersQueryParams,
  ListMapMarkersResponse,
  ListPlansResponse,
  Profile,
  SearchAllQueryParams,
  SearchAllResponse,
  SubmitContactBody,
  SubmitContactResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const imageUrls = {
  marrakech: "https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1200&q=80",
  medina: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80",
  chefchaouen: "https://images.unsplash.com/photo-1548786811-dd6e453ccca7?auto=format&fit=crop&w=1200&q=80",
  essaouira: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1200&q=80",
  desert: "https://images.unsplash.com/photo-1547234935-80c7145ec969?auto=format&fit=crop&w=1200&q=80",
};

function numberValue(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function businessView(business: typeof businessesTable.$inferSelect) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    category: business.category,
    city: business.city,
    shortDescription: business.shortDescription,
    imageUrl: business.imageUrl,
    rating: numberValue(business.rating) ?? 0,
    reviewCount: business.reviewCount,
    isOpen: business.isOpen,
    priceLevel: business.priceLevel,
    latitude: numberValue(business.latitude),
    longitude: numberValue(business.longitude),
  };
}

function destinationView(destination: typeof destinationsTable.$inferSelect) {
  return {
    id: destination.id,
    name: destination.name,
    slug: destination.slug,
    city: destination.city,
    description: destination.description,
    imageUrl: destination.imageUrl,
    kind: destination.kind,
  };
}

async function getLocalUser(userId: string) {
  const [existing] = await db
    .select()
    .from(localUsersTable)
    .where(eq(localUsersTable.clerkUserId, userId))
    .limit(1);
  let clerkEmail = "";
  let clerkName = "";
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    clerkEmail = clerkUser.primaryEmailAddress?.emailAddress || "";
    clerkName = clerkUser.fullName || clerkUser.firstName || "";
  } catch {
    // Keep the local account usable if Clerk's user API is temporarily unavailable.
  }
  const email = clerkEmail || existing?.email || `${userId}@local.morocco-now`;
  const name = clerkName || existing?.name || "Morocco Now member";
  const isAdmin = Boolean(process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase());
  if (existing) {
    if (existing.name !== name || existing.email !== email || (isAdmin && existing.role !== "ADMIN")) {
      const [updated] = await db.update(localUsersTable).set({ name, email, ...(isAdmin ? { role: "ADMIN" } : {}) }).where(eq(localUsersTable.id, existing.id)).returning();
      return updated;
    }
    return existing;
  }
  const [created] = await db
    .insert(localUsersTable)
    .values({ clerkUserId: userId, name, email, role: isAdmin ? "ADMIN" : "TOURIST" })
    .returning();
  return created;
}

router.post("/account/sync", requireAuth, async (req, res): Promise<void> => {
  const user = await getLocalUser((req as AuthenticatedRequest).userId);
  res.json({ id: user.clerkUserId, name: user.name, email: user.email, role: user.role });
});

router.get("/home", async (_req, res): Promise<void> => {
  const [categories, destinations, featured, popular, experiences] = await Promise.all([
    db.select().from(categoriesTable).orderBy(categoriesTable.name),
    db.select().from(destinationsTable).orderBy(destinationsTable.name).limit(8),
    db.select().from(businessesTable).where(eq(businessesTable.featured, true)).limit(6),
    db.select().from(businessesTable).orderBy(desc(businessesTable.reviewCount)).limit(6),
    db.select().from(destinationsTable).where(eq(destinationsTable.kind, "experience")).limit(6),
  ]);

  const response = GetHomeResponse.parse({
    heroTitle: "Your Morocco. One place.",
    heroSubtitle: "Find the places, people, and experiences that make Morocco unforgettable.",
    categories,
    destinations: destinations.map(destinationView),
    featuredBusinesses: featured.map(businessView),
    popularBusinesses: popular.map(businessView),
    experiences: experiences.map(destinationView),
  });
  res.json(response);
});

router.get("/businesses", async (req, res): Promise<void> => {
  const parsed = ListBusinessesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, category, city, limit } = parsed.data;
  const filters = [
    eq(businessesTable.status, "published"),
    category ? ilike(businessesTable.category, `%${category}%`) : undefined,
    city ? ilike(businessesTable.city, `%${city}%`) : undefined,
    search
      ? or(
          ilike(businessesTable.name, `%${search}%`),
          ilike(businessesTable.shortDescription, `%${search}%`),
          ilike(businessesTable.city, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean);
  const businesses = await db
    .select()
    .from(businessesTable)
    .where(and(...filters))
    .orderBy(desc(businessesTable.featured), desc(businessesTable.rating))
    .limit(limit ?? 12);
  res.json(ListBusinessesResponse.parse(businesses.map(businessView)));
});

router.get("/businesses/:slug", async (req, res): Promise<void> => {
  const parsed = GetBusinessParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [business] = await db.select().from(businessesTable).where(eq(businessesTable.slug, parsed.data.slug));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const [products, services] = await Promise.all([
    db.select().from(productsTable).where(and(eq(productsTable.businessId, business.id), eq(productsTable.status, "active"))),
    db.select().from(servicesTable).where(and(eq(servicesTable.businessId, business.id), eq(servicesTable.status, "active"))),
  ]);
  res.json(
    GetBusinessResponse.parse({
      ...businessView(business),
      description: business.description,
      address: business.address,
      phone: business.phone,
      whatsapp: business.whatsapp,
      website: business.website,
      openingHours: business.openingHours,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        currency: product.currency,
        imageUrl: product.imageUrl,
        status: product.status,
      })),
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        priceCents: service.priceCents,
        currency: service.currency,
        durationMinutes: service.durationMinutes,
        imageUrl: service.imageUrl,
        status: service.status,
      })),
      featured: business.featured,
    }),
  );
});

router.get("/businesses/:slug/reviews", async (req, res): Promise<void> => {
  const params = ListBusinessReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [business] = await db.select({ id: businessesTable.id }).from(businessesTable).where(eq(businessesTable.slug, params.data.slug));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.businessId, business.id), eq(reviewsTable.status, "published")))
    .orderBy(desc(reviewsTable.createdAt));
  res.json(
    ListBusinessReviewsResponse.parse(
      reviews.map((review) => ({
        id: review.id,
        businessId: review.businessId,
        userName: review.userName,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      })),
    ),
  );
});

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(ListCategoriesResponse.parse(rows));
});

router.get("/cities", async (_req, res): Promise<void> => {
  const rows = await db.select().from(citiesTable).orderBy(citiesTable.name);
  res.json(ListCitiesResponse.parse(rows));
});

router.get("/destinations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(destinationsTable).orderBy(destinationsTable.name);
  res.json(ListDestinationsResponse.parse(rows.map(destinationView)));
});

router.get("/map/markers", async (req, res): Promise<void> => {
  const parsed = ListMapMarkersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, city } = parsed.data;
  const rows = await db
    .select()
    .from(businessesTable)
    .where(
      and(
        eq(businessesTable.status, "published"),
        category ? ilike(businessesTable.category, `%${category}%`) : undefined,
        city ? ilike(businessesTable.city, `%${city}%`) : undefined,
      ),
    );
  res.json(
    ListMapMarkersResponse.parse(
      rows
        .filter((row) => row.latitude !== null && row.longitude !== null)
        .map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          category: row.category,
          city: row.city,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        })),
    ),
  );
});

router.get("/search", async (req, res): Promise<void> => {
  const parsed = SearchAllQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const needle = `%${parsed.data.q}%`;
  const [businesses, destinations] = await Promise.all([
    db
      .select()
      .from(businessesTable)
      .where(or(ilike(businessesTable.name, needle), ilike(businessesTable.shortDescription, needle), ilike(businessesTable.city, needle)))
      .limit(8),
    db
      .select()
      .from(destinationsTable)
      .where(or(ilike(destinationsTable.name, needle), ilike(destinationsTable.city, needle), ilike(destinationsTable.description, needle)))
      .limit(8),
  ]);
  res.json(SearchAllResponse.parse({ businesses: businesses.map(businessView), destinations: destinations.map(destinationView) }));
});

router.get("/account/profile", requireAuth, async (req, res): Promise<void> => {
  const user = await getLocalUser((req as AuthenticatedRequest).userId);
  const [{ count: favoriteCount }] = await db.select({ count: sql<number>`count(*)` }).from(favoritesTable).where(eq(favoritesTable.userId, user.id));
  const [{ count: reviewCount }] = await db.select({ count: sql<number>`count(*)` }).from(reviewsTable).where(eq(reviewsTable.userId, user.id));
  res.json(
    GetProfileResponse.parse({
      id: user.clerkUserId,
      name: user.name,
      email: user.email,
      role: user.role,
      country: user.country,
      preferredLanguage: user.preferredLanguage,
      favoriteCount: Number(favoriteCount),
      reviewCount: Number(reviewCount),
    }),
  );
});

router.get("/account/favorites", requireAuth, async (req, res): Promise<void> => {
  const user = await getLocalUser((req as AuthenticatedRequest).userId);
  const rows = await db
    .select({ business: businessesTable })
    .from(favoritesTable)
    .innerJoin(businessesTable, eq(favoritesTable.businessId, businessesTable.id))
    .where(eq(favoritesTable.userId, user.id))
    .orderBy(desc(favoritesTable.createdAt));
  res.json(ListFavoritesResponse.parse(rows.map((row) => businessView(row.business))));
});

router.post("/account/favorites/:businessId", requireAuth, async (req, res): Promise<void> => {
  const params = AddFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await getLocalUser((req as AuthenticatedRequest).userId);
  const [favorite] = await db
    .insert(favoritesTable)
    .values({ userId: user.id, businessId: params.data.businessId })
    .onConflictDoNothing()
    .returning();
  const response = favorite ?? (await db.select().from(favoritesTable).where(and(eq(favoritesTable.userId, user.id), eq(favoritesTable.businessId, params.data.businessId))).limit(1))[0];
  if (!response) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  res.status(201).json(AddFavoriteResponse.parse({ businessId: response.businessId, createdAt: response.createdAt.toISOString() }));
});

router.delete("/account/favorites/:businessId", requireAuth, async (req, res): Promise<void> => {
  const params = AddFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await getLocalUser((req as AuthenticatedRequest).userId);
  await db.delete(favoritesTable).where(and(eq(favoritesTable.userId, user.id), eq(favoritesTable.businessId, params.data.businessId)));
  res.sendStatus(204);
});

router.post("/reviews", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getLocalUser((req as AuthenticatedRequest).userId);
  const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, parsed.data.businessId));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const [review] = await db
    .insert(reviewsTable)
    .values({ ...parsed.data, userId: user.id, userName: user.name })
    .returning();
  const nextReviewCount = business.reviewCount + 1;
  const nextRating = ((Number(business.rating) * business.reviewCount + parsed.data.rating) / nextReviewCount).toFixed(2);
  await db.update(businessesTable).set({ reviewCount: nextReviewCount, rating: nextRating }).where(eq(businessesTable.id, business.id));
  res.status(201).json(
    CreateReviewResponse.parse({
      id: review.id,
      businessId: review.businessId,
      userName: review.userName,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    }),
  );
});

router.get("/plans", async (_req, res): Promise<void> => {
  const plans = await db.select().from(plansTable).where(eq(plansTable.active, true)).orderBy(plansTable.audience, plansTable.priceCents);
  res.json(ListPlansResponse.parse(plans));
});

router.post("/subscriptions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getLocalUser((req as AuthenticatedRequest).userId);
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, parsed.data.planId));
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  const [subscription] = await db.insert(subscriptionsTable).values({ userId: user.id, planId: plan.id }).returning();
  res.status(201).json(
    CreateSubscriptionResponse.parse({
      id: subscription.id,
      planId: subscription.planId,
      status: subscription.status,
      paymentStatus: subscription.paymentStatus,
      providerConfigured: subscription.providerConfigured,
    }),
  );
});

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AskMoroccoAiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const question = parsed.data.question.toLowerCase();
  const matchingBusinesses = await db
    .select()
    .from(businessesTable)
    .where(or(ilike(businessesTable.name, `%${parsed.data.question}%`), ilike(businessesTable.city, `%${parsed.data.question}%`)))
    .limit(3);
  let answer = "Morocco AI is not configured yet. I can still help once the platform has verified data for your question.";
  if (matchingBusinesses.length > 0) {
    answer = `I found ${matchingBusinesses.length} published place${matchingBusinesses.length === 1 ? "" : "s"} in the platform data: ${matchingBusinesses.map((business) => `${business.name} in ${business.city}`).join(", ")}.`;
  } else if (question.includes("restaurant") || question.includes("eat") || question.includes("food")) {
    const restaurants = await db.select().from(businessesTable).where(ilike(businessesTable.category, "%restaurant%")).limit(3);
    if (restaurants.length > 0) {
      answer = `Based on the published listings, you can start with ${restaurants.map((business) => `${business.name} in ${business.city}`).join(", ")}. Check each profile for current hours and contact details.`;
    }
  }
  res.json(AskMoroccoAiResponse.parse({ answer, configured: false, sources: matchingBusinesses.map((business) => `/business/${business.slug}`) }));
});

router.post("/contact", async (req, res): Promise<void> => {
  const parsed = SubmitContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [message] = await db.insert(contactMessagesTable).values(parsed.data).returning();
  res.status(201).json(SubmitContactResponse.parse({ id: message.id, status: message.status, createdAt: message.createdAt.toISOString() }));
});

export default router;