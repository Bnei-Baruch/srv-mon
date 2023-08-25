import React, {Component} from 'react';
import {Segment} from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';
import './App.css';
import Monitor from "./components/Monitor";

class App extends Component {

    state = {};

  render() {

    return (
        <Segment basic>
            <Monitor />
        </Segment>
    );
  }
}

export default App;
