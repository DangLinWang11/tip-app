export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#ff3131',      // Updated to match your onboarding
        secondary: '#029094',    // Your teal color
        accent: '#FFC529',
        background: '#FFFFFF',
        'light-gray': '#F5F5F5',
        'medium-gray': '#E0E0E0',
        'dark-gray': '#9E9E9E',
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        kent: ['KENT', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translate(-50%, 20px)', opacity: '0' },
          '100%': { transform: 'translate(-50%, 0)', opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out forwards',
      },
    },
  },
}