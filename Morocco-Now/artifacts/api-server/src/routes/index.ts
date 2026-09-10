import { Router, type IRouter } from "express";
import healthRouter from "./health";
import moroccoRouter from "./morocco";

const router: IRouter = Router();

router.use(healthRouter);
router.use(moroccoRouter);

export default router;
