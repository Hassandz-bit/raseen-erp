import { seedDemoCommerceScenarios } from "../server/demo.ts";

const actorUserId = Number(process.env.DEMO_ACTOR_USER_ID || "1");
if (!Number.isInteger(actorUserId) || actorUserId <= 0) throw new Error("DEMO_ACTOR_USER_ID يجب أن يكون معرف مستخدم موجباً.");

const result = await seedDemoCommerceScenarios(actorUserId);
console.log(JSON.stringify({ action: "seed-demo-commerce-scenarios", ...result }, null, 2));
