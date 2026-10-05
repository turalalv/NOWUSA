import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  await db.$transaction([
    db.session.deleteMany({ where: { shop } }),
    db.googleConnection.deleteMany({where:{shop}}),
    db.googleOAuth.deleteMany({where:{shop}}),
    db.trafficConnection.deleteMany({where:{shop}}),
    db.trafficOAuth.deleteMany({where:{shop}}),
    db.visitorTracker.deleteMany({where:{shop}}),
    db.visitorEvent.deleteMany({where:{shop}}),
    db.visitorBotEvent.deleteMany({where:{shop}}),
    db.imageCompression.deleteMany({where:{shop}}),
    db.seoReportDelivery.deleteMany({where:{shop}}),
    db.seoWorkspace.deleteMany({ where: { shop } }),
    db.seoChange.deleteMany({ where: { shop } }),
  ]);

  return new Response();
};
