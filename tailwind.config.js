/** @type {import('tailwindcss').Config} */
export default {
  content: ['./views/**/*.ejs', './public/js/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { vines: { navy: '#071f52', blue: '#1549af', gold: '#ffc928', pale: '#f5f8ff' } },
      fontFamily: { display: ['Outfit', 'sans-serif'], body: ['DM Sans', 'sans-serif'] },
      boxShadow: { soft: '0 16px 44px rgba(16,39,87,.11)' }
    }
  },
  plugins: []
};
