/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
"./*.html",
    "./admin_html/**/*.html", 
    "./user_html/**/*.html",  
    "./components/**/*.html",
    "./admin_js/**/*.js",
    "./user_js/**/*.js",     
    "./public_view/**/*.html"       
  ],
  safelist: [
    'bg-[#183B5B]',
    'bg-[#2E5F87]',
    'from-[#183B5B]',
    'to-[#2E5F87]',
    'w-72',
    'fixed',
    'inset-y-0',
    'left-0',
    'z-50'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}