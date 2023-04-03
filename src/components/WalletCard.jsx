import React, { useState, useEffect, useCallback } from "react";

const { ethers } = require("ethers");

const WalletCard = () => {
  // ---------------- State variables ----------------
  // MetaMask related
  const [defaultAccount, setDefaultAccount] = useState(null);
  const [userBalance, setUserBalance] = useState(null);
  const [connButtonText, setConnButtonText] = useState("Connect Wallet");
  const [userTransactions, setUserTransactions] = useState(null);
  const [sendFundsDetails, setSendFundsDetails] = useState({
    address: "",
    amount: "",
  });

  // App functionality
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [message, setMessage] = useState(null);
  const [isConnnected, setIsConnected] = useState(false);

  // ---------------- MetaMask related functionalities ----------------
  const connectWalletHandler = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask");
      }

      const networkVersion = await window.ethereum.request({
        method: "net_version",
      });

      if (networkVersion !== "5") {
        throw new Error("Please connect to Goerli Test Network");
      }

      await connectToWallet();
      setIsConnected(true);
      successMessageDisplay("Successfully Connected to Wallet!");
    } catch (error) {
      console.log("error------", error);
      errorMessageDisplay("Error connecting to wallet. Check if you are connected to the correct network!", error);
    }
  };

  const connectToWallet = async () => {
    try {
      setIsLoading(true);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const account = accounts[0];
      accountChangedHandler(account);
      setConnButtonText("Wallet Connected");
      await Promise.all([
        getUserBalance(account),
        fetchTransactionHistory(account),
      ]);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      errorMessageDisplay("Error connecting to wallet ", error);
    }
  };

  // handles account changes
  const accountChangedHandler = useCallback((newAccount) => {
    setDefaultAccount(newAccount);
    getUserBalance(newAccount.toString());
    fetchTransactionHistory(newAccount.toString());
  }, []);

  // fetches the user's balance
  const getUserBalance = async (address) => {
    try {
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      });
      setUserBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      errorMessageDisplay("Error fetching user balance ", error);
    }
  };

  // fetches the user transactions
  const fetchTransactionHistory = async (address) => {
    try {
      const API_ENDPOINT = `https://api-goerli.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey=539BR6VBD82DVVP85KHDAHF9M5DB7NSNJI`;
      const response = await fetch(API_ENDPOINT);
      const { result } = await response.json();

      if (result.length === 0) {
        setUserTransactions(null);
        return;
      }

      setUserTransactions(result);
    } catch (error) {
      errorMessageDisplay("Error fetching transaction history ", error);
    }
  };

  // Send funds to another address
  const sendFundsHandler = async (e) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      const txParams = {
        from: defaultAccount,
        to: sendFundsDetails.address,
        value: ethers.utils.parseEther(sendFundsDetails.amount).toString(),
      };

      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      await Promise.all([
        getUserBalance(defaultAccount),
        fetchTransactionHistory(defaultAccount),
      ]);

      setIsLoading(false);
      successMessageDisplay(
        "Successfully sent funds! Please wait until the transaction table is updated."
      );
    } catch (error) {
      setIsLoading(false);
      errorMessageDisplay("Error sending funds", error);
    }
  };

  // periodically fetches the user's transaction history
  useEffect(() => {
    const fetchAndSetTransactionHistory = async () => {
      await fetchTransactionHistory(defaultAccount);
      await getUserBalance(defaultAccount);
    };

    // fetch transaction history every 5 second(s)
    const interval = setInterval(() => {
      if (!isConnnected) return;
      fetchAndSetTransactionHistory();
    }, 5000);

    // listens for account changes
    window.ethereum?.on("accountsChanged", accountChangedHandler);

    return () => {
      window.ethereum?.removeListener("accountsChanged", accountChangedHandler);
      clearInterval(interval);
    };
  });

  useEffect(() => {
    if (defaultAccount !== null && typeof defaultAccount == "object") {
      accountChangedHandler(defaultAccount[0]);
      setDefaultAccount(defaultAccount[0]);
    }
  }, [defaultAccount, accountChangedHandler]);

  // refresh page on network change
  window.ethereum?.on("chainChanged", (chainId) => window.location.reload());

  const successMessageDisplay = (message) => {
    setMessage(message);
    setIsAlertVisible(true);
    setTimeout(() => {
      setIsAlertVisible(false);
    }, 5000);
  };

  const errorMessageDisplay = (message, error) => {
    setErrorMessage(message, error.message);
    setIsAlertVisible(true);
    setTimeout(() => {
      setIsAlertVisible(false);
    }, 5000);
  };

  // used for rendering the transaction history
  const transactionRows =
    userTransactions == null || userTransactions.length <= 0 ? (
      <p className="has-text-centered has-text-danger">No Transactions</p>
    ) : (
      userTransactions.map((transaction, index) => {
        const etherscanLink = `https://goerli.etherscan.io/tx/${transaction.hash}`;
        return (
          <tr key={index}>
            <td>
              <a href={etherscanLink}>{transaction.hash}</a>
            </td>
            <td>{transaction.blockNumber}</td>
            <td>
              {parseFloat(ethers.utils.formatEther(transaction.value)).toFixed(
                2
              )}
            </td>
          </tr>
        );
      })
    );

  // ---------------- Render related functionalities ----------------
  const renderTransactions = () => {
    return (
      <div>
        <div className="table-container p-3 custom-box">
          <table className="table is-striped is-hoverable is-fullwidth p-3">
            <thead>
              <tr>
                <th>Transaction Hash</th>
                <th>Block Number</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>{transactionRows}</tbody>
          </table>
        </div>
      </div>
    );
  };

  const sendFundsChangeHandler = (e) => {
    const { name, value } = e.target;
    setSendFundsDetails((prevState) => ({ ...prevState, [name]: value }));
  };

  const renderSendFunds = () => {
    return (
      <div className="custom-box field p-5">
        <h3 className="title is-4 has-text-weight-bold has-text-centered mb-4">
          Send ETH Payment
        </h3>
        <form onSubmit={sendFundsHandler}>
          <div className="field is-horizontal">
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <input
                    className="input is-normal is-hovered"
                    name="address"
                    type="text"
                    placeholder="Recipient Address"
                    onChange={(e) => sendFundsChangeHandler(e)}
                  />
                </div>
              </div>
              <div className="field">
                <div className="control">
                  <input
                    className="input is-normal is-hovered"
                    name="amount"
                    type="text"
                    placeholder="Amount in ETH"
                    onChange={(e) => sendFundsChangeHandler(e)}
                  />
                </div>
              </div>
              <div className="field">
                <div className="control">
                  <button
                    className="button is-primary is-rounded is-fullwidth"
                    type="submit"
                  >
                    Send Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  };

  const renderWalletConnection = () => {
    return (
      <div className={isConnnected ? "custom-box" : ""}>
        <div className="content has-text-centered">
          <button
            className="button is-primary is-rounded"
            onClick={!isConnnected && connectWalletHandler}
          >
            {connButtonText}
          </button>
          {isConnnected && (
            <>
              <div className="pt-4 pl-3">
                <h4>
                  Address:{" "}
                  <a
                    href={`https://goerli.etherscan.io/address/${defaultAccount}`}
                  >
                    {defaultAccount}
                  </a>
                </h4>
              </div>
              <div className="pl-3">
                <h4>Balance: {userBalance}</h4>
              </div>
              <div className="pb-4 pl-3">
                <h6>Network: Goerli Testnet</h6>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="walletCard">
      {message && isAlertVisible && (
        <>
          <br />
          <div className="message content box p-3">
            <p className="has-text-success">{message}</p>
          </div>
        </>
      )}
      {errorMessage && isAlertVisible && (
        <>
          <div className="message content box p-3">
            <p className="has-text-danger">{errorMessage}</p>
          </div>
        </>
      )}
      {isLoading && (
        <>
          <br />
          <p className="has-text-info card">
            Current opperation is processing! Please wait...
          </p>
        </>
      )}

      <br />
      {renderWalletConnection()}
      {isConnnected && (
        <>
          <br />
          {renderTransactions()}
          <br />
          {renderSendFunds()}
        </>
      )}
      <br />
    </div>
  );
};

export default WalletCard;
