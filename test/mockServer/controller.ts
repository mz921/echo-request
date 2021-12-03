import { FastifyReply, FastifyRequest } from 'fastify';
import MockData from './mock-data.json';

const UserController = {
	async list(req: FastifyRequest, reply: FastifyReply) {
		const userProps: any = req.query;

		reply.send(
			MockData.users.filter(
				(user: any) =>
					Object.keys(userProps)
						.map((p) => userProps[p] === user[p])
						.findIndex((v) => !v) === -1
			)
		);
	},

	async create(req: FastifyRequest, reply: FastifyReply) {
		const newUser = req.body;
		//@ts-ignore
		MockData.users = [...MockData.users, newUser];
		reply.send(MockData.users);
	},

	async view(req: FastifyRequest, reply: FastifyReply) {
        reply.code(400)
    },

	async update(req: FastifyRequest, reply: FastifyReply) {
		reply.code(400);
	},

	async delete(req: FastifyRequest, reply: FastifyReply) {
		reply.code(400);
	},
};

const ArticleController = {
	async list(req: FastifyRequest, reply: FastifyReply) {
		const articleProps: any = req.query;

		reply.send(
			MockData.articles.filter(
				(article: any) =>
					Object.keys(articleProps)
						.map((p) => articleProps[p] === String(article[p]))
						.findIndex((v) => !v) === -1
			)
		);
	},

	async create(req: FastifyRequest, reply: FastifyReply) {
		const newArticle = req.body;
		//@ts-ignore
		MockData.users = [...MockData.articles, newArticle];
		reply.send(MockData.articles);
	},

	async view(req: FastifyRequest, reply: FastifyReply) {
		reply.code(400)
	},

	async update(req: FastifyRequest, reply: FastifyReply) {
		reply.code(400);
	},

	async delete(req: FastifyRequest, reply: FastifyReply) {
		reply.code(400);
	},
};

export { UserController, ArticleController };
