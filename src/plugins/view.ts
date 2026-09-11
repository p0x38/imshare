import fp from "fastify-plugin";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import { join } from "node:path";

export default fp(async (fastify) => {
    await fastify.register(fastifyView, {
        engine: {
            ejs,
        },
        root: join(process.cwd(), "views"),
        viewExt: "ejs",
    });
});
