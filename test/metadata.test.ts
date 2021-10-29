import { metadataManagerFactory, IMetadataManager } from '../src/metadata';

let TestMetadataManager: new (metadata: any, target: Object, propertyKey?: string | symbol) => IMetadataManager<any>;
let testMetadataManager: IMetadataManager<any>;
let id = 0;

beforeAll(() => {
	const testSymbol = Symbol('test');

	TestMetadataManager = metadataManagerFactory<any>(testSymbol);
});

beforeEach(() => {
	testMetadataManager = new TestMetadataManager({ name: 'Stella Kozey' }, { id });
    id+=1;
});

describe('Metadata Test', () => {
	test('singleton', () => {
		const testMetadataManager1 = new TestMetadataManager({ name: 'Tara Veum' }, { id: -1 });
		const testMetadataManager2 = new TestMetadataManager({ name: 'Stella Kozey' }, { id: -1 });

		expect(testMetadataManager1 === testMetadataManager2).toBeTruthy();
		expect(testMetadataManager1.get()).toEqual({ name: 'Tara Veum' });
	});

	test('get', () => {
		expect(testMetadataManager.get()).toEqual({ name: 'Stella Kozey' });
	});

	test('replace', () => {
		const data = { name: 'Tara Veum', age: 33 };

		testMetadataManager.replace(data);

		expect(testMetadataManager.get()).toEqual(data);
	});

	test('set', () => {
		testMetadataManager.set((data) => {
			data.name = 'Paul George';
		});

		expect(testMetadataManager.get()).toEqual({
			name: 'Paul George',
		});
	});
});
