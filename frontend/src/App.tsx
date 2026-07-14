import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import Router from './router/routes';
import { ThemeProvider } from './contexts/ThemeContext';
import { FilterProvider } from './contexts/FilterContext';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <FilterProvider>
          <Layout>
            <Router />
          </Layout>
        </FilterProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
