const SITE_TITLE = 'aramuk/login'

class MenuBar extends React.Component{
    render(){
        if(this.props.loggedIn){
            return([
                <a href='/'><div id='site-title'>{this.props.title}</div></a>,
                <AccountChip first={this.props.first} last={this.props.last}/>,
                <Dropdown first={this.props.first}/>
            ]);
        }
        return([
            <a href='/'><div id='site-title'>{this.props.title}</div></a>,
            <a href="/login"><div class="log redirect">Sign In</div></a>
        ])
    };
};

class AccountChip extends React.Component{

    handleClick(){
        if($('.dropdown').is(':visible')){
            $('.dropdown').css({'display':'none'});
        }
        else{
            $('.dropdown').css({'display':'block'});
        }
    }

    render(){
        return([
            <div id='chip' class='log redirect' style={{width: '120px'}} onClick={this.handleClick}>
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
                <Edit />
                <a class='redirect p-nav' href='/logout'>Log Out</a>
            </div>
        );
    };
};

class UserData extends React.Component{
    render() {
        return (
            <div>
                <p>Welcome {this.props.first} {this.props.last}!</p>
                <p>Born: {this.props.dob}</p>
            </div>
        );
    };
};

class Edit extends React.Component{
    handleClick(){
        $('#chip').click();
        axios.get('/editAccount').then(res => {
            const editForm = res.data;
            ReactDOM.render(
                <EditForm/>,
                document.getElementsByClassName('content')[0]
            );
            // $('#fname').val(data.fname);
            // $('#lname').val(data.lname);
            // $('#bday').val(data.bday);
        });
    }

    render(){
        return(
            <a id='edit' class='redirect p-nav' onClick={this.handleClick}>Edit Profile</a>
        );
    };  
}

class EditForm extends React.Component{
    render(){
        return(
            <div class='form'>
                <form id='editAccount' action='/update' method='post'>
                    <label for='fname'>First Name</label>
                    <input id='fname' name='fname'/>
                    <br/><br/><label for='lname'>Last Name</label>
                    <input id='lname' name='lname'/>
                    <br/><br/><label for='bday'>Birthday</label>
                    <input id='bday' name='bday'/>
                    <br/><br/><input type='submit' class='redirect' value='Update'/>
                </form>
            </div>
        );
    };
};

function loadHomePage(loggedIn){
    if(loggedIn){
        axios.get('/loadData').then(res => {
            loadMenu(true, res.data);
            loadData(res.data);
        });
    }
    else{
        loadMenu(false)
    }
}


function loadMenu(loggedIn, data={}){
    ReactDOM.render(
        <MenuBar loggedIn={loggedIn} title={SITE_TITLE} first={data.fname} last={data.lname}/>,
        document.getElementsByClassName('menu-bar')[0]
    );   
};

function loadData(data){
    ReactDOM.render(
        <UserData first={data.fname} last={data.lname} dob={data.bday}/>,
        document.getElementById('content')
    );
}