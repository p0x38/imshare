import type { FastifyPluginAsync } from "fastify";

const home: FastifyPluginAsync = async (fastify) => {
    fastify.get("/", async (_request, reply) => {
        return reply.view("index.ejs", {
            title: "imshare",
            message: "test",
        });
    });
};

export default home;
