# Watercolor Value Study Tool 🎨

A minimalist, privacy-first web application designed to help artists translate complex reference photos into simplified value layers. 

Built immediately to run locally inside your browser (meaning no images are ever sent to a server), this tool calculates exact image luminance values to break difficult subjects down into 2 to 9 visual blocks. Extremely useful for watercolorists, gouache painters, or concept artists looking to establish foundational tone mapping.

**[Live Demo via Vercel](https://value-study.vercel.app)**

## Features

- **Standard Luminance Mapping:** Accurate toggling into Grayscale using standard relative luminance calculation equations (`0.299*R + 0.587*G + 0.114*B`).
- **Dynamic Posterization Engine:** A smooth slider dictating the total tonal limit for the composition (2 to 9 values).
- **Threshold Swatch Isolation:** Every tonal bucket becomes a selectable swatch; clicking an individual swatch converts anything bound to that specific luminance bucket into a vivid high-contrast overlay (`Red-500`) to quickly lock down shape outlines.
- **Client-Side HTML5 Canvas:** Processing is extremely fast regardless of complex uploads. We utilize an off-DOM scalable layout mapped via a hidden 2D context to run `getImageData` pixel chunking.

## Quick Start
To set up this environment locally:

```bash
# Clone the repository
git clone https://github.com/TMTrevisan/value-study.git
cd value-study

# Install the minimal dependencies
npm install

# Start the active Vite development server
npm run dev
```

You can then view the application safely at `http://localhost:5173`. If you'd like to beam this over your Wi-Fi directly to an iPad/Tablet sitting on your easel, stop the server and instead run:
```bash
npm run dev -- --host
```

## Tech Stack
- Frontend Engine: [React](https://react.dev) + [Vite](https://vitejs.dev)
- Styling & Responsiveness: [Tailwind CSS v4](https://tailwindcss.com/)
- Visual Language Structure: [Lucide React](https://lucide.dev/)
- Image Pipeline: `CanvasRenderingContext2D`
