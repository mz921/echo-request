import { Req, Get, Post, useHttpClient, Params, Merge, Headers, Res, InjectRes, Catch } from '../src/index';
import HttpClient from './httpClient';

class TestService {
	@Req({
		request: {
			method: 'GET',
			url: '/users',
			headers: {},
			key: 'getUsers',
		},
	})
	static getUsers(): any {}

	@Get({
		request: {
			url: '/users',
			headers: {},
			key: 'getUsers',
		},
	})
	static getUsersWithGetDecorator(): any {}

	@Get({
		request: {
			url: '/users',
			headers: {},
			key: 'getUsers',
			wait: true
		},
	})	
	@Post({
		request: {
			url: '/users',
			data: {
				createdAt: '2021-12-01T12:11:51.534Z',
				name: 'james mcavoy',
				avatar: 'https://cdn.fakercloud.com/avatars/pierre_nel_128.jpg',
				id: '51',
			},	
		},
	})
	static createUser(): any {}

	@Catch((e: any) => e.statusCode)
	@Req({
		request: {
			method: 'GET',
			url: '/uers',
			headers: {},
			key: 'getUsers',
		},
	})
	static getUsersWithWrongURL(): any {}

	@InjectRes
	@Req({
		request: {
			method: 'GET',
			url: '/users',
			headers: {},
			key: 'getUsers',
		},
	})
	static getUserData(@Res res?: any): any {
		return {
			data: res,
		};
	}

	@Req({
		request: {
			method: 'GET',
			url: '/users',
			params: {
				name: Symbol.for('name'),
			},
		},
	})
	static getUserFromName(@Params('name') name: string): any {}

	@Req({
		request: {
			send: TestService.getUserFromName,
			sendArguments: [Symbol.for('name')]
		}
	})
	static getUserFromService(@Params('name') name: string): any {}

	@Merge((user1, user2) => user1.concat(user2))
	@Req({
		request: {
			method: 'GET',
			url: '/users',
			params: {
				name: Symbol.for('name2'),
			},
		},
	})
	@Req({
		request: {
			method: 'GET',
			url: '/users',
			params: {
				name: Symbol.for('name1'),
			},
		},
	})
	static getUsersFrom2Names(@Params('name1') name1: string, @Params('name2') name2: string): any {}

	@Merge((users, user3) => {
		return users.concat(user3);
	})
	@Req({
		request: {
			method: 'GET',
			url: '/users',
			params: {
				name: Symbol.for('name3'),
			},
		},
	})
	@Merge((user1, user2) => {
		return user1.concat(user2);
	})
	@Req({
		request: {
			method: 'GET',
			url: '/users',
			params: {
				name: Symbol.for('name2'),
			},
		},
	})
	@Req({
		request: {
			method: 'GET',
			url: '/users',
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

	@Req({
		request: {
			method: 'GET',
			url: '/articles',
			params: {
				author: Symbol.for('userID'),
			},
			wait: true,
		},
	})
	@Req({
		request: {
			method: 'GET',
			url: '/users',
			params: {
				name: Symbol.for('name'),
			},
		},
		response: {
			transformers: (users) => Number(users[0].id),
			key: 'userID',
		},
	})
	static getArticlesFromUser(@Params('name') name: string): any {}
}

beforeAll(() => {
	useHttpClient(HttpClient);
});

describe('GET Request With Req Decorator', () => {
	test('response', () => {
		return TestService.getUsers().then((res: any) => {
			expect(res).toHaveLength(50);
		});
	});

	test('request params', () => {
		return TestService.getUserFromName('Tony Farrell').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-12-01T07:27:02.218Z',
					name: 'Tony Farrell',
					avatar: 'https://cdn.fakercloud.com/avatars/klefue_128.jpg',
					id: '1',
				},
			]);
		});
	});

	test('merge', () => {
		return TestService.getUsersFrom2Names('Hector Cormier', 'Clayton Medhurst').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-12-01T19:51:10.700Z',
					name: 'Hector Cormier',
					avatar: 'https://cdn.fakercloud.com/avatars/hjartstrorn_128.jpg',
					id: '2',
				},
				{
					createdAt: '2021-12-01T17:40:41.302Z',
					name: 'Clayton Medhurst',
					avatar: 'https://cdn.fakercloud.com/avatars/timothycd_128.jpg',
					id: '3',
				},
			]);
		});
	});

	test('merge scope', () => {
		return TestService.getUsersFrom3Names('Tony Farrell', 'Hector Cormier', 'Clayton Medhurst').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-12-01T07:27:02.218Z',
					name: 'Tony Farrell',
					avatar: 'https://cdn.fakercloud.com/avatars/klefue_128.jpg',
					id: '1',
				},
				{
					createdAt: '2021-12-01T19:51:10.700Z',
					name: 'Hector Cormier',
					avatar: 'https://cdn.fakercloud.com/avatars/hjartstrorn_128.jpg',
					id: '2',
				},
				{
					createdAt: '2021-12-01T17:40:41.302Z',
					name: 'Clayton Medhurst',
					avatar: 'https://cdn.fakercloud.com/avatars/timothycd_128.jpg',
					id: '3',
				},
			]);
		});
	});

	test('wait', () => {
		return TestService.getArticlesFromUser('Tony Farrell').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-12-01T17:17:21.048Z',
					title: 'Global Program Associate',
					author: 1,
					id: '11',
				},
			]);
		});
	});

	test('inject res', () => {
		return TestService.getUserData().then((res: any) => {
			expect(res.data).toHaveLength(50);
		});
	});

	test('catch', () => {
		return TestService.getUsersWithWrongURL().then((res: any) => {
			expect(res).toBe(404);
		});
	});
});

describe('Get Request With Get Decorator', () => {
	test('response', () => {
		return TestService.getUsersWithGetDecorator().then((res: any) => {
			expect(res).toHaveLength(50);
		});
	});
});

describe('Post Request With Post Decorator', () => {
	test('create user', () => {
		return TestService.createUser().then((res: any) => {
			expect(res).toHaveLength(51);
		})
	})
})

describe('Anonymous Request With Req Decorator', () => {
	test('reuse other service', () => {
		TestService.getUserFromService('Tony Farrell').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-12-01T07:27:02.218Z',
					name: 'Tony Farrell',
					avatar: 'https://cdn.fakercloud.com/avatars/klefue_128.jpg',
					id: '1',
				},
			]);
		});
	})
})