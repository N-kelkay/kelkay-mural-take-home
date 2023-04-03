import './App.css';
import NavBar from './components/NavBar';
import WalletCard from './components/WalletCard';
import SafeTest from './components/SafeTest';
import 'bulma/css/bulma.min.css';

function App() {
  let component
  switch (window.location.pathname) {
    case "/":
      component = <WalletCard />;
      break;
    case "/wallet":
      component = <WalletCard />;
      break;
    case "/multi-sig":
      component = <SafeTest />;
      break;
    default:
      component = <WalletCard />;
  }

  return (
    <>
      <div className='App'>
        <NavBar />
        {component}
      </div>
    </>
  );
}

export default App;
