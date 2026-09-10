import type { FastifyPluginAsync } from "fastify";

import { healthRoutes } from "./health.js";
import { userRoutes } from "./users.js";
import { postRoutes } from "./posts.js";
import { tagRoutes } from "./tags.js";
import { categoryRoutes } from "./categories.js";
import { searchRoutes } from "./search.js";
import { uploadRoutes } from "./uploads.js";
import { imageRoutes } from "./images.js";
import { reactionRoutes } from "./reactions.js";
import { profileLinkRoutes } from "./profile-links.js";

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(userRoutes);
  await fastify.register(postRoutes);
  await fastify.register(reactionRoutes);
  await fastify.register(profileLinkRoutes);
  await fastify.register(tagRoutes);
  await fastify.register(categoryRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(uploadRoutes);
  await fastify.register(imageRoutes);
};
