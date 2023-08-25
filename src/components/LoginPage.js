import React, { Component } from 'react';
import {kc,getUser} from './UserManager';
import {Container,Message,Button,Dropdown,Image} from 'semantic-ui-react';
import logo from './logo.png';
import {KC_URL} from "../shared/tools";

class LoginPage extends Component {

    state = {
        disabled: true,
        loading: true,
    };

    componentDidMount() {
        this.appLogin();
    };

    appLogin = () => {
        getUser((user) => {
            if(user) {
                this.setState({loading: false});
                this.props.checkPermission(user);
            } else {
                this.setState({disabled: false, loading: false});
            }
        });
    };

    userLogin = () => {
        this.setState({disabled: true, loading: true});
        kc.login({redirectUri: window.location.href});
    };

    render() {

        const {disabled, loading} = this.state;

        let login = (<Button size='massive' primary onClick={this.userLogin} disabled={disabled} loading={loading}>Login</Button>);
        let logout = (<Image src={logo} centered />);
        let profile = (
            <Dropdown inline text=''>
                <Dropdown.Menu>
                    <Dropdown.Item content='Profile:' disabled />
                    <Dropdown.Item text='My Account' onClick={() => window.open(`${KC_URL}/realms/main/account`, "_blank")} />
                    <Dropdown.Item text='Sign Out' onClick={() => kc.logout()} />
                </Dropdown.Menu>
            </Dropdown>);

        return (
            <Container textAlign='center' >
                <Message size='massive'>
                    <Message.Header>
                        {this.props.user === null ? "BB Shidur Admin" : "Welcome, "+this.props.user.name}
                        {this.props.user === null ? "" : profile}
                    </Message.Header>
                    <p>{this.props.user === null ? "Administrative Tools and Services" : "BB Shidur Admin"}</p>
                    {this.props.user === null ? login : logout}
                </Message>
            </Container>
        );
    }
}

export default LoginPage;
