import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the BrainteaserDay landing page', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', {
      name: /fais travailler ton cerveau, un jour à la fois/i,
    })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /jouer gratuitement/i })
  ).toBeInTheDocument();
});

