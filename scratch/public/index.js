console.log('index.js loaded');

class MenuBar extends React.Component{
    render(){
        return([
            <a href='/'><div id='site-title'>{this.props.title}</div></a>,
            <AccountChip first="John" last="Doe" />,
            <Dropdown first="John" />
        ]);
    };
};

class AccountChip extends React.Component{
    render(){
        return([
            <div id='chip' class='log redirect' styles={{width: '120px;'}}>
                {this.props.first} {this.props.last}
            </div>
        ]);
    };
};

class Dropdown extends React.Component{
    render(){
        return(
            <div class='dropdown'>
                <div class='portrait'>{this.props.first[0]}</div>
                <a id='edit' class='redirect p-nav'>Edit Profile</a>
                <a class='redirect p-nav' href='/logout'>Log Out</a>
            </div>
        );
    };
};

function loadHomePage(){
    console.log('loading');
    loadMenu();
}

function loadMenu(){
    ReactDOM.render(
        <MenuBar title='aramuk/login'/>,
        document.getElementsByClassName('menu-bar')[0]
    );
};