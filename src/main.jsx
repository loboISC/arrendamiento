import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div>
      <h1>Hello World!</h1>
      <p>Your React application is successfully running.</p>
      <p>From here, you can start building your components inside the <code>src/renderer</code> directory.</p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
