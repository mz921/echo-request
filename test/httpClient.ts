import http from 'http';

class HttpClient {
	static get(url: string, parmas?: { [prop: string]: any }, headers?: { [prop: string]: any }) {
		let raw = '';

		const req = http.get({
			hostname: 'localhost',
			port: 3000,
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
				res.on('data', (chunk) => (raw += chunk));

				res.on('end', () => {
					const res = JSON.parse(raw);
					if (res.statusCode && res.statusCode !== 200) {
						reject(res);
					} else {
						resolve(res);
					}
				});

				res.on('error', (e) => reject(e));
			});
		});
	}

	static post(url: string, data?: { [prop: string]: any }, headers?: { [prop: string]: any }) {
		let raw = '';
        const body = JSON.stringify(data)

		const req = http.request({
			hostname: 'localhost',
			port: 3000,
			path: url,
			method: 'POST',
			headers: {
                'Content-Type': 'application/json',
                'Content-Length': body.length,
                ...headers
            }
		});

		req.on('error', (error) => {
			console.error(error);
		});

        req.write(body)

		req.end();

		return new Promise((resolve, reject) => {
			req.on('response', (res) => {
				res.on('data', (chunk) => (raw += chunk));

				res.on('end', () => {
					const res = JSON.parse(raw);
					if (res.statusCode && res.statusCode !== 200) {
						reject(res);
					} else {
						resolve(res);
					}
				});

				res.on('error', (e) => reject(e));
			});
		});
	}
}

export default HttpClient;
