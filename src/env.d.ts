// .astro files are compiled by the consuming site (and by Astro in the component tests); TypeScript only needs to know they exist.
declare module "*.astro" {
	const Component: any;
	export default Component;
}
