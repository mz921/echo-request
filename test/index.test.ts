import { Get, useHttpClient, Params, Merge } from '../src/index';
import https from 'https';

class TestService {
	@Get({
		request: {
			url: '/test/users',
		},
	})
	static getUsers(): any {}

	@Get({
		request: {
			url: '/test/users',
			params: {
				name: Symbol.for('name'),
			},
		},
	})
	static getUserFromName(@Params('name') name: string): any {}

	@Merge((user1, user2) => user1.concat(user2))
	@Get({
		request: {
			url: '/test/users',
			params: {
				name: Symbol.for('name2'),
			},
		},
	})
	@Get({
		request: {
			url: '/test/users',
			params: {
				name: Symbol.for('name1'),
			},
		},
	})
	static getUsersFrom2Names(@Params('name1') name1: string, @Params('name2') name2: string): any {}

	@Merge((users, user3) => {
		console.log('merge2')
		return users.concat(user3)
	})
	@Get({
		request: {
			url: '/test/users',
			params: {
				name: Symbol.for('name3'),
			},
		},
	})
	@Merge((user1, user2) => {
			console.log('merge1')
		 return user1.concat(user2)
	})
	@Get({
		request: {
			url: '/test/users',
			params: {
				name: Symbol.for('name2'),
			},
		},
	})
	@Get({
		request: {
			url: '/test/users',
			params: {
				name: Symbol.for('name1'),
			},
		},
	})
	static getUsersFrom3Names(
		@Params('name1') name1: string,
		@Params('name2') name2: string,
		@Params('name3') name3: string
	): any {}

	// @Sequence
	// @Get({
	// 	request: {
	// 		url: '/test/articles',
	// 		params: {
	// 			author: Symbol.for('userID')
	// 		}
	// 	}
	// })
	// @Get({
	// 	request: {
	// 		url: '/test/users',
	// 		params: {
	// 			name: Symbol.for('name')
	// 		}
	// 	},
	// 	response: {
	// 		transformers: (users) => users[0].id,
	// 		name: "userID"
	// 	}
	// })
	// static getArticlesFromUser(@Params('name') name: string): any {}
}

class HttpClient {
	static get(url: string, parmas?: { [prop: string]: any }, headers?: { [prop: string]: any }) {
		let data = '';

		const req = https.get({
			hostname: '61489642035b3600175b9f58.mockapi.io',
			port: 443,
			path: url + `?${new URLSearchParams(parmas).toString()}`,
			method: 'GET',
			headers,
		});

		req.on('error', (error) => {
			console.error(error);
		});

		req.end();

		return new Promise((resolve, reject) => {
			req.on('response', (res) => {
				res.on('data', (chunk) => (data += chunk));

				res.on('end', () => {
					resolve(JSON.parse(data));
				});

				res.on('error', (e) => reject(e));
			});
		});
	}
}

beforeAll(() => {
	useHttpClient(HttpClient);
});

describe('GET Request', () => {
	test('response', () => {
		return TestService.getUsers().then((res: any) => {
			expect(res).toHaveLength(50);
		});
	});

	test('request params', () => {
		return TestService.getUserFromName('Bethany Johns').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-10-28T04:10:26.100Z',
					name: 'Bethany Johns',
					avatar: 'https://cdn.fakercloud.com/avatars/uberschizo_128.jpg',
					id: '1',
				},
			]);
		});
	});

	test('merge', () => {
		return TestService.getUsersFrom2Names('Bethany Johns', 'Renee Gleichner').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-10-28T04:10:26.100Z',
					name: 'Bethany Johns',
					avatar: 'https://cdn.fakercloud.com/avatars/uberschizo_128.jpg',
					id: '1',
				},
				{
					createdAt: '2021-10-28T08:28:49.712Z',
					name: 'Renee Gleichner',
					avatar: 'https://cdn.fakercloud.com/avatars/pcridesagain_128.jpg',
					id: '2',
				},
			]);
		});
	});

	test.only('merge scope', () => {
		return TestService.getUsersFrom3Names('Bethany Johns', 'Renee Gleichner', 'Wilfred Adams').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-10-28T04:10:26.100Z',
					name: 'Bethany Johns',
					avatar: 'https://cdn.fakercloud.com/avatars/uberschizo_128.jpg',
					id: '1',
				},
				{
					createdAt: '2021-10-28T08:28:49.712Z',
					name: 'Renee Gleichner',
					avatar: 'https://cdn.fakercloud.com/avatars/pcridesagain_128.jpg',
					id: '2',
				},
				{
					createdAt: '2021-10-28T21:31:57.354Z',
					name: 'Wilfred Adams',
					avatar: 'https://cdn.fakercloud.com/avatars/robergd_128.jpg',
					id: '3',
				},
			]);
		});
	});
});
