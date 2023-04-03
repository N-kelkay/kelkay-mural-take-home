import React from "react";

const NavBar = () => {
    return (
        <div className="nav-bar">
            <nav className="navbar">
                <div className="navbar-menu">
                    <div className="navbar-start"> 
                        <a className="navbar-item" href="/wallet"> Wallet Card </a>
                        <a className="navbar-item" href="/multi-sig"> Multi Sig </a>
                    </div>
                </div>
            </nav>
        </div>
    )
}

export default NavBar;