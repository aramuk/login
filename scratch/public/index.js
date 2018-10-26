const SITE_TITLE = 'aramuk/login'

class MenuBar extends React.Component{
    render(){
        return([
            <a href='/'><div id='site-title'>{this.props.title}</div></a>,
            <AccountChip first={this.props.first} last={this.props.last}/>,
            <Dropdown first={this.props.first}/>
        ]);
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
                    <br/>
                    <br/>
                    <label for='fname'>First Name</label>
                    <br/><input id='fname' name='fname'/>
                    <br/><label for='lname'>Last Name</label>
                    <br/><input id='lname' name='lname'/>
                    <br/><label for='bday'>Birthday</label>
                    <br/><input id='bday' name='bday'/>
                    <br/><input type='submit' class='redirect' value='Update'/>
                    <br/>
                </form>
            </div>
        );
    };
};

function loadHomePage(){
    axios.get('/loadData').then(res => {
        loadMenu(res.data);
        loadData(res.data);
    });

}

function loadMenu(data){
    ReactDOM.render(
        <MenuBar title={SITE_TITLE} first={data.fname} last={data.lname}/>,
        document.getElementsByClassName('menu-bar')[0]
    );
};

function loadData(data){
    ReactDOM.render(
        <UserData first={data.fname} last={data.lname} dob={data.bday}/>,
        document.getElementById('content')
    );
}