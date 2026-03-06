/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    900: '#134e4a',
                }
            }
        },
    },
    plugins: [],
}
