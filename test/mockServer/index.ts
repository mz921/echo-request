import Fastify from 'fastify';
//@ts-ignore
import crud from 'fastify-crud-generator';
import { UserController } from './controller';
import { ArticleController } from './controller';

const fastify = Fastify()
	.register(crud, {
		prefix: '/users',
		controller: UserController,
	})
	.register(crud, {
		prefix: '/articles',
		controller: ArticleController,
	});

fastify.listen(3000, function (err, address) {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
});
