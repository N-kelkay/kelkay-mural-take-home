import React, { useEffect, useState } from "react";

import Safe, { SafeFactory } from "@safe-global/safe-core-sdk";
import EthersAdapter from "@safe-global/safe-ethers-lib";
import { ethers } from "ethers";

const SafeTest = () => {
  // Add existing safe
  const [safeAddressInput, setSafeAddressInput] = useState("");
  const [safeAddress, setSafeAddress] = useState();

  // new owner
  const [newOwnerInput, setNewOwnerInput] = useState();

  // current safe
  const [owners, setOwners] = useState([]);
  const [safe, setSafe] = useState();
  const [threshold, setThreshold] = useState();
  const [changeThresholdVal, setChangeThresholdVal] = useState();
  const [nicknames, setNicknames] = useState({});

  // app functionality
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [message, setMessage] = useState(null);
  const [isValid, setIsValid] = useState(false);

  // create safe
  const [createSafeApprovers, setCreateSafeApprovers] = useState([
    { name: "", address: "" },
  ]);
  const [createSafeThreshold, setCreateSafeThreshold] = useState(1);

  // ---------------- Safe related functionalities ----------------
  const connectToSafe = async (e) => {
    e.preventDefault();

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner(0);
    const ethAdapterOwner = new EthersAdapter({
      ethers,
      signerOrProvider: signer,
    });

    const safeAddress = safeAddressInput.trim();
    if (!/^(0x)?[0-9a-fA-F]{40}$/i.test(safeAddress)) {
      errorMessageDisplay("Invalid safe address");
      return;
    }

    setIsLoading(true);
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    setIsLoading(false);

    if (accounts.length === 0) {
      errorMessageDisplay("Please connect to metamask");
      return;
    }

    try {
      setIsLoading(true);

      const safeSdk = await Safe.create({
        ethAdapter: ethAdapterOwner,
        safeAddress,
      });
      const owners = await safeSdk.getOwners();
      const ownersWithNicknames = owners.map((owner, index) => ({
        owner,
        nickname: `owner ${owners.length - index}`,
      }));

      await Promise.all([
        setSafe(safeSdk),
        setSafeAddress(await safeSdk.getAddress()),
        setThreshold(await safeSdk.getThreshold()),
        setOwners(owners),
        setNicknames(
          Object.fromEntries(
            ownersWithNicknames.map((o) => [o.owner, o.nickname])
          )
        ),
      ]);

      setIsLoading(false);
      successMessageDisplay("Successfully Connected to the Safe!");
    } catch (error) {
      setIsLoading(false);
      errorMessageDisplay("Error connecting to safe ", error);
    }
  };

  const createNewSafe = async (e) => {
    e.preventDefault();

    const names = createSafeApprovers.map((approver) => approver.name);
    const inputOwners = createSafeApprovers.map((approver) => approver.address);

    if (createSafeApprovers.length === 0) {
      errorMessageDisplay("Please add at least one approver ");
      return;
    }

    if (new Set(inputOwners).size !== inputOwners.length) {
      errorMessageDisplay("Duplicate owners detected ", null);
      return;
    }

    for (let i = 0; i < inputOwners.length; i++) {
      if (!/^(0x)?[0-9a-fA-F]{40}$/i.test(inputOwners[i])) {
        errorMessageDisplay("Invalid owner(s) address");
        return;
      }
    }

    setIsLoading(true);
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    setIsLoading(false);

    if (accounts.length === 0) {
      errorMessageDisplay("Please connect to metamask");
      return;
    }

    try {
      setIsLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner(0);
      const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: signer,
      });
      const safeFactory = await SafeFactory.create({ ethAdapter });
      const safeAccountConfig = {
        owners: inputOwners,
        threshold: createSafeThreshold,
      };
      const safeSdk = await safeFactory.deploySafe({ safeAccountConfig });

      const owners = await safeSdk.getOwners();
      const ownersWithNicknames = owners.map((owner, index) => ({
        owner,
        nickname: names[owners.length - (index + 1)] || `owner ${index + 1}`,
      }));

      await Promise.all([
        setSafe(safeSdk),
        setSafeAddress(await safeSdk.getAddress()),
        setThreshold(await safeSdk.getThreshold()),
        setOwners(owners),
        setNicknames(
          Object.fromEntries(
            ownersWithNicknames.map((o) => [o.owner, o.nickname])
          )
        ),
      ]);
      successMessageDisplay("Successfully created new safe!");
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      errorMessageDisplay("Error creating new safe ", error);
    }
  };

  const addOwner = async (e) => {
    e.preventDefault();
    if (window.confirm("Are you sure you want to add this owner?")) {
      try {
        setIsLoading(true);
        const params = { ownerAddress: newOwnerInput };
        const safeTransaction = await safe.createAddOwnerTx(params);

        if (threshold > 1) {
          getOwnerSignatures(safeTransaction);
        } else {
          await safe.signTransaction(safeTransaction);
          const txResponse = await safe.executeTransaction(safeTransaction);
          await txResponse.transactionResponse.wait();
        }

        const newOwners = [...owners, newOwnerInput];
        setOwners(newOwners);
        const newNicknames = { ...nicknames, [newOwnerInput]: "Owner" };
        setNicknames(newNicknames);
        setIsLoading(false);
        successMessageDisplay("Successfully Added Owner!");
      } catch (error) {
        setIsLoading(false);
        errorMessageDisplay("Error Adding Owner ", error);
      }
    }
  };

  const removeOwner = async (e, owner) => {
    e.preventDefault();
    if (window.confirm("Are you sure you want to remove this owner?")) {
      try {
        setIsLoading(true);
        if (threshold > 1) {
          const params = { ownerAddress: owner };
          const safeTransaction = await safe.createRemoveOwnerTx(params);
          getOwnerSignatures(safeTransaction);
        } else {
          const params = { ownerAddress: owner, threshold: threshold };
          const safeTransaction = await safe.createRemoveOwnerTx(params);
          await safe.signTransaction(safeTransaction);
          const txResponse = await safe.executeTransaction(safeTransaction);
          await txResponse.transactionResponse?.wait();
        }

        const newOwners = owners.filter((o) => o !== owner);
        const newNicknames = { ...nicknames };
        delete newNicknames[owner];

        setOwners(newOwners);
        setNicknames(newNicknames);
        setIsLoading(false);
        successMessageDisplay("Successfully removed the owner from the Safe!");
      } catch (error) {
        setIsLoading(false);
        errorMessageDisplay("Error removing owner ", error);
      }
    }
  };

  const changeThreshold = async (e) => {
    e.preventDefault();

    if (window.confirm("Are you sure you want to change the threshold?")) {
      try {
        setIsLoading(true);
        const safeTransaction = await safe.createChangeThresholdTx(
          changeThresholdVal
        );
        if (threshold > 1) {
          await getOwnerSignatures(safeTransaction);
        } else {
          await safe.signTransaction(safeTransaction);
          const txResponse = await safe.executeTransaction(safeTransaction);
          await txResponse.transactionResponse?.wait();
        }
        setThreshold(await safe.getThreshold());
        setIsLoading(false);
        successMessageDisplay("Successfully changed the threshold!");
      } catch (error) {
        setIsLoading(false);
        errorMessageDisplay("Error changing threshold ", error);
      }
    }
  };

  // HELPER: get owner signatures
  const getOwnerSignatures = async (safeTransaction) => {
    const safes = [safe];
    const provider = new ethers.providers.Web3Provider(window.ethereum);

    // off chain signature
    await safe.signTransaction(safeTransaction);
    const txHash = await safe.getTransactionHash(safeTransaction);

    // on chain signature
    for (let i = threshold - 2; i >= 0; i--) {
      const signer = provider.getSigner(owners[i]);
      const ethAdapterOwner = new EthersAdapter({
        ethers,
        signerOrProvider: signer,
      });

      const currentSafe = safes[0];
      const safeSdk = await currentSafe.connect({
        ethAdapter: ethAdapterOwner,
        safeAddress: safeAddress,
      });
      safes.pop();
      safes.push(safeSdk);
      const approveTxResponse = await safeSdk.approveTransactionHash(txHash);
      await approveTxResponse.transactionResponse?.wait();
    }

    // now we can execute the transaction (done by the last approver)
    const signer = provider.getSigner(owners[threshold - 1]);
    const ethAdapterOwnerLast = new EthersAdapter({
      ethers,
      signerOrProvider: signer,
    });
    const currentSafe = safes[0];
    const safeSdkLast = await currentSafe.connect({
      ethAdapter: ethAdapterOwnerLast,
      safeAddress,
    });

    if (await safeSdkLast.isValidTransaction(safeTransaction)) {
      const executeTxResponse = await safeSdkLast.executeTransaction(
        safeTransaction
      );
      await executeTxResponse.transactionResponse?.wait();
    } else {
      throw new Error("Invalid Transaction");
    }
  };

  useEffect(() => {
    const checkNetworkVersion = async () => {
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

        setIsValid(true);
        setIsAlertVisible(false);
      } catch (error) {
        setErrorMessage(error.message);
        setIsAlertVisible(true);
        setTimeout(() => {
          setIsAlertVisible(false);
        }, 3000);
      }
    };

    checkNetworkVersion();
  }, []);

  // refresh page on network change
  window.ethereum?.on("chainChanged", (chainId) => window.location.reload());

  // ---------------- Render related functionalities ----------------

  // handlers for create new safe form
  const handleCreateFormChange = (index, event) => {
    event.preventDefault();
    let data = [...createSafeApprovers];
    data[index][event.target.name] = event.target.value;
    setCreateSafeApprovers(data);
  };

  const addFieldsCreateForm = (e) => {
    e.preventDefault();
    let newfield = { name: "", address: "" };
    setCreateSafeApprovers([...createSafeApprovers, newfield]);
  };

  const removeFieldsCreateForm = (e, index) => {
    e.preventDefault();
    let data = [...createSafeApprovers];
    data.splice(index, 1);
    setCreateSafeApprovers(data);
  };

  // renders Safe Form
  const renderCreateNewSafe = () => {
    return (
      <div className="custom-box">
        <h1 className="title">Create Safe</h1>
        <div className="control">
          <button
            className="button"
            disabled={!isValid}
            onClick={addFieldsCreateForm}
          >
            Add
          </button>
        </div>
        <form onSubmit={createNewSafe}>
          {createSafeApprovers.map((input, index) => {
            return (
              <div className="field is-grouped" key={index}>
                <div className="control">
                  <input
                    name="name"
                    placeholder="Name"
                    className="input"
                    value={input.name}
                    disabled={!isValid}
                    onChange={(event) => handleCreateFormChange(index, event)}
                  />
                </div>
                <div className="control">
                  <input
                    name="address"
                    placeholder="address"
                    className="input"
                    value={input.address}
                    disabled={!isValid}
                    onChange={(event) => handleCreateFormChange(index, event)}
                  />
                </div>
                <div className="control">
                  <button
                    className="button is-danger"
                    disabled={!isValid}
                    onClick={(e) => removeFieldsCreateForm(e, index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}

          <div className="field">
            <label className="label">
              Any Transaction Requires the Confirmation of
            </label>
            <div className="control">
              <div className="select">
                <select
                  name="threshold"
                  onChange={(e) => setCreateSafeThreshold(e.target.value)}
                >
                  {createSafeApprovers.map((data, i) => (
                    <option value={i + 1} key={i} disabled={!isValid}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              <p className="help" style={{ display: "inline-block" }}>
                &nbsp;out of {createSafeApprovers.length} owner(s)
              </p>
            </div>
          </div>

          <div className="field is-grouped">
            <div className="control">
              <button
                className="button is-primary"
                disabled={!isValid}
                onClick={createNewSafe}
              >
                Create Safe
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  const renderConnectToSafeForm = () => {
    return (
      <div className="container custom-box">
        <h1 className="title">Connect to Safe</h1>
        <form onSubmit={connectToSafe}>
          <div className="field">
            <label className="label">Safe Address</label>
            <div className="control">
              <input
                type="text"
                className="input"
                placeholder="Enter safe address"
                disabled={!isValid}
                onChange={(e) => setSafeAddressInput(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <div className="control">
              <button
                type="submit"
                className="button is-primary"
                disabled={!isValid}
              >
                Connect to Safe
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  // handle nickname change in owner table
  const handleNicknameChange = (e, owner) => {
    const newNicknames = { ...nicknames };
    newNicknames[owner] = e.target.value;
    setNicknames(newNicknames);
  };
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const handleEditNickname = () => {
    setIsEditingNickname(true);
  };
  const handleNicknameBlur = () => {
    setIsEditingNickname(false);
  };

  const renderOwnerTable = () => {
    return (
      <div className="custom-box">
        <div className="table-container">
          <table className="table is-striped is-hoverable is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {owners
                .slice()
                .reverse()
                .map((owner, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        className="input"
                        value={nicknames[owner]}
                        onChange={(e) => handleNicknameChange(e, owner)}
                        disabled={!isEditingNickname}
                        onBlur={handleNicknameBlur}
                      ></input>
                    </td>
                    <td>
                      <a href={"https://goerli.etherscan.io/address/" + owner}>
                        {owner}
                      </a>
                    </td>
                    <td>
                      <div className="buttons">
                        <button
                          className="button is-small is-danger"
                          disabled={isEditingNickname}
                          onClick={(e) => removeOwner(e, owner)}
                        >
                          Remove
                        </button>
                        <button
                          className="button is-small is-warning"
                          onClick={handleEditNickname}
                          disabled={isEditingNickname}
                        >
                          Edit Nickname
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderThreshold = () => {
    return (
      <div className="custom-box">
        <div className="columns is-vcentered is-mobile">
          <div className="column">
            <p className="subtitle is-4">Threshold: {threshold}</p>
          </div>
          <div className="column is-narrow">
            <div className="field has-addons">
              <p className="control">
                <input
                  className="input is-normal"
                  type="number"
                  placeholder="Enter new threshold"
                  onChange={(e) => {
                    setChangeThresholdVal(e.target.value);
                  }}
                />
              </p>
              <p className="control">
                <button
                  className="button is-primary is-normal"
                  type="submit"
                  onClick={changeThreshold}
                >
                  Change
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAddOwnerForm = () => {
    return (
      <div className="custom-box">
        <form onSubmit={addOwner}>
          <fieldset>
            <legend className="subtitle is-4">Add Owner</legend>
            <div className="field">
              <label className="label">Owner Address</label>
              <div className="control">
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. 0x123456789abcdef"
                  onChange={(e) => {
                    setNewOwnerInput(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="field is-grouped">
              <div className="control">
                <button className="button is-primary" onClick={addOwner}>
                  Add Owner
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      </div>
    );
  };

  const renderSafeInfo = () => {
    return (
      <div className="custom-box has-text-centered subheading p-3 text-align:left">
        <h1>
          Safe Address:{" "}
          <strong>
            <a href={"https://goerli.etherscan.io/address/" + safeAddress}>
              {safeAddress}
            </a>
          </strong>
        </h1>
      </div>
    );
  };

  const successMessageDisplay = (message) => {
    setMessage(message);
    setIsAlertVisible(true);
    setTimeout(() => {
      setIsAlertVisible(false);
    }, 5000);
  };

  const errorMessageDisplay = (message, error) => {
    setErrorMessage(message, error);
    setIsAlertVisible(true);
    setTimeout(() => {
      setIsAlertVisible(false);
    }, 5000);
  };

  return (
    <div>
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
      {!safe ? (
        <div>
          <br />
          {renderConnectToSafeForm()}
          <br />
          {renderCreateNewSafe()}
          <br />
        </div>
      ) : (
        <div>
          <br />
          {renderSafeInfo()}
          <br />
          {renderOwnerTable()}
          <br />
          {renderAddOwnerForm()}
          <br />
          {renderThreshold()}
          <br />
        </div>
      )}
    </div>
  );
};

export default SafeTest;
