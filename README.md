# CommonPlate Mobile UI Design

CommonPlate is a mobile-first web application designed to help groups of friends agree on where to eat. It creates a seamless, democratic, and fun "matching" experience for dining out, eliminating the dreaded "I don't know, what do you want?" conversation.

This project was built for the **Yelp AI API Hackathon**, leveraging AI to intelligently parse menus and recommend dining spots based on group preferences.

## Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

-   Node.js (v18 or higher recommended)
-   npm or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/arthik444/YELPB.git
    cd YELPB
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory and add your Firebase and Yelp API credentials.
    ```env
    VITE_FIREBASE_API_KEY=your_firebase_api_key
    ...
    ```

4.  **Run the User Interface**
    ```bash
    npm run dev
    ```
    Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### Building for Production

To create a production-ready build:

```bash
npm run build
```

## Features

-   **Session Implementation**: Create or join a "Lobby" to collaborate with friends in real-time.
-   **Swipe Interface**: Tinder-style "Swipe Right/Left" mechanism to vote on restaurants.
-   **Group Preferences**: Filter by cuisine, budget, vibe, dietary restrictions, and distance.
-   **Smart Matching**: The app identifies the "Winner" restaurant that satisfies the group's collective cravings.
-   **Mobile-First Design**: Optimized for mobile devices with a premium, app-like feel using "Organic Modern" aesthetics.

## Tech Stack

This project uses a modern frontend stack to deliver a smooth and responsive user experience.

-   **Framework**: [React 19](https://react.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Styling**: 
    -   [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
    -   [Radix UI](https://www.radix-ui.com/) for unstyled, accessible UI primitives.
    -   [Lucide React](https://lucide.dev/) for icons.
-   **Animations**: [Framer Motion](https://www.framer.com/motion/) for fluid transitions and swipe effects.
-   **Backend / Services**: 
    -   [Firebase](https://firebase.google.com/) for real-time session management and data persistence.
    -   [Leaflet](https://leafletjs.com/) for map visualizations.

## Code Architecture

The application focuses on a **Single Page Application (SPA)** architecture with a custom state-based router for smooth transitions between "screens".

### Directory Structure

```
src/
├── components/       # UI Screens and reusable components
│   ├── WelcomeScreen.tsx  # Landing page
│   ├── LobbyScreen.tsx    # detailed session setup & preference input
│   ├── SwipeScreen.tsx    # Main voting interface
│   └── WinnerScreen.tsx   # Results display
├── services/         # Business logic and API integration
│   └── sessionService.ts  # Firebase interactions
├── hooks/            # Custom React hooks
├── config/           # App configuration
├── guidelines/       # Project guidelines
├── styles/           # Global styles and tailwind config
├── App.tsx           # Main entry point & State Router
└── main.tsx          # React Root
```

### Application Flow

1.  **Welcome**: Users land on the `WelcomeScreen`.
2.  **Lobby**: They navigate to `LobbyScreen` to create a session ID and share it with friends.
3.  **Preferences**: The group sets preferences (Cuisine, Vibe, Budget, etc.).
4.  **Swipe**: Everyone enters the `SwipeScreen` to vote on options generated based on preferences.
5.  **Match**: Once a consensus is reached (or logic dictates), the `WinnerScreen` displays the chosen restaurant.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
