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
		return TestService.getUserFromName('Stella Kozey').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-09-19T16:31:18.103Z',
					name: 'Stella Kozey',
					avatar: 'https://cdn.fakercloud.com/avatars/orkuncaylar_128.jpg',
					id: '1',
				},
			]);
		});
	});

	test('merge', () => {
		return TestService.getUsersFrom2Names('Stella Kozey', 'Tara Veum').then((res: any) => {
			expect(res).toEqual([
				{
					createdAt: '2021-09-19T16:31:18.103Z',
					name: 'Stella Kozey',
					avatar: 'https://cdn.fakercloud.com/avatars/orkuncaylar_128.jpg',
					id: '1',
				},
				{
					createdAt: '2021-09-19T22:10:28.175Z',
					name: 'Tara Veum',
					avatar: 'https://cdn.fakercloud.com/avatars/id835559_128.jpg',
					id: '3',
				},
			]);
		});
	});
});
