import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon"),
});

export const citiesTable = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  region: text("region").notNull(),
  imageUrl: text("image_url"),
});

export const destinationsTable = pgTable("destinations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  city: text("city").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  kind: text("kind").notNull(),
});

export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  category: text("category").notNull(),
  city: text("city").notNull(),
  shortDescription: text("short_description").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  isOpen: boolean("is_open").notNull().default(true),
  priceLevel: text("price_level").notNull().default("$"),
  address: text("address").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  website: text("website"),
  openingHours: jsonb("opening_hours").$type<Record<string, string>>().notNull().default({}),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  featured: boolean("featured").notNull().default(false),
  status: text("status").notNull().default("published"),
  ...timestamps,
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("MAD"),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("MAD"),
  durationMinutes: integer("duration_minutes"),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const localUsersTable = pgTable("local_users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("TOURIST"),
  country: text("country"),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  ...timestamps,
});

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => localUsersTable.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title").notNull(),
  comment: text("comment").notNull(),
  status: text("status").notNull().default("published"),
  ...timestamps,
});

export const favoritesTable = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => localUsersTable.id, { onDelete: "cascade" }),
    businessId: integer("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    userBusinessUnique: uniqueIndex("favorites_user_business_unique").on(table.userId, table.businessId),
  }),
);

export const plansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  audience: text("audience").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull(),
  description: text("description").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => localUsersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  providerConfigured: boolean("provider_configured").notNull().default(false),
  ...timestamps,
});

export const contactMessagesTable = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  ...timestamps,
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export const insertCitySchema = createInsertSchema(citiesTable).omit({ id: true });
export const insertDestinationSchema = createInsertSchema(destinationsTable).omit({ id: true });
export const insertBusinessSchema = createInsertSchema(businessesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLocalUserSchema = createInsertSchema(localUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFavoriteSchema = createInsertSchema(favoritesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactMessageSchema = createInsertSchema(contactMessagesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Category = typeof categoriesTable.$inferSelect;
export type City = typeof citiesTable.$inferSelect;
export type Destination = typeof destinationsTable.$inferSelect;
export type Business = typeof businessesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type Service = typeof servicesTable.$inferSelect;
export type LocalUser = typeof localUsersTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type Favorite = typeof favoritesTable.$inferSelect;
export type Plan = typeof plansTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type ContactMessage = typeof contactMessagesTable.$inferSelect;

export const reviewRatingSchema = z.number().int().min(1).max(5);