import React, {Component} from 'react'
import {Checkbox, Divider, Segment, Label, Dropdown, Message, Button, List, Table, Menu} from 'semantic-ui-react'
import {getService, putData, toHms} from "../shared/tools";
import Service from "./Service";
import mqtt from "../shared/mqtt";


class Captures extends Component {

    state = {
        capture: {},
        id: "",
        room: {"room":1051,"janus":"gxy8","description":"Test Room","questions":false,"num_users":0,"users":null,"region":"","extra":null},
        rooms: [{"room":1051,"janus":"gxy8","description":"Test Room","questions":false,"num_users":0,"users":null,"region":"","extra":null}],
        ival: null,
        services: [],
        status: "",
        stat: {cpu: "", hdd: "", temp: ""}
    };

    componentDidMount() {
        this.props.onRef(this)
        const {id,captures} = this.props;
        if(id)
            this.setCapture(id, captures[id]);
    };

    componentWillUnmount() {
        this.props.onRef(undefined)
        clearInterval(this.state.ival);
    };

    onMqttMessage = (message, topic) => {
        let services = message.data;
        const local = true
        const src = local ? topic.split("/")[3] : topic.split("/")[4];
        if(this.state.id)
        if(services && this.state.id === src) {
            for(let i=0; i<services.length; i++) {
                //services[i].out_time = services[i].log.split('time=')[1].split('.')[0];
                services[i].out_time = toHms(services[i].runtime);
            }
            //console.debug("[capture] Message: ", services);
            this.setState({services});
        // } else {
        //     this.setState({services: []});
        }
    };

    setCapture = (id, capture) => {
        console.log(":: Set capture: ",capture);
        this.setState({id, capture}, () => {
            this.runTimer();
        });
        if(id !== this.props.id)
            this.props.idState("capture_id", id);
    };

    addService = () => {
        const {capture, room} = this.state;
        if(!capture.services) {
            capture.services = [];
        }
        const id = "janus-" + (capture.services.length + 1).toString();
        const description = room.description;
        const cmd = `janus.py --play-from video.mp4 --room ${room.room} https://gxy8.kli.one/janusgxy`;
        const args = cmd.split(" ");
        capture.services.push({description, id, name: "python3", args});
        this.saveData(capture)
    };

    delService = (i) => {
        const {capture} = this.state;
        if(capture.alive)
            return;
        capture.services.splice(i, 1);
        this.saveData(capture)
    };

    addNote = (i, description) => {
        const {capture} = this.state;
        capture.services[i].description = description;
        this.saveData(capture);
    };

    saveData = (props) => {
        const {id} = this.state;
        putData(`streamer/captures/${id}`, props, (data) => {
            console.log("saveProp callback: ", data);
        });
    };

    setJsonState = (key, value) => {
        let {capture, id} = this.state;
        capture.jsonst[key] = value;
        this.props.jsonState("captures", {[id]: capture}, id);
    };

    startEncoder = () => {
        let {id} = this.state;
        //getService(id + "/start", () => {})
        mqtt.send("start", false, "exec/service/" + id);
    };

    stopEncoder = () => {
        let {id} = this.state;
        //getService(id + "/stop", () => {})
        mqtt.send("stop", false, "exec/service/" + id);
    };

    runTimer = () => {
        this.getStat();
        if(this.state.ival)
            clearInterval(this.state.ival);
        let ival = setInterval(() => {
            this.getStat();
        }, 1000);
        this.setState({ival});
    };

    getStat = () => {
        const {id} = this.state;
        mqtt.send("status", false, "exec/service/" + id);
        // getService(id + "/status", (services) => {
        //     if(services) {
        //         for(let i=0; i<services.length; i++) {
        //             //services[i].out_time = services[i].log.split('time=')[1].split('.')[0];
        //             services[i].out_time = toHms(services[i].runtime);
        //         }
        //         this.setState({services});
        //     } else {
        //         this.setState({services: []});
        //     }
        // })
    };

    render() {

        const {captures} = this.props;
        const {capture, id, status, stat, services} = this.state;

        let cap_options = Object.keys(captures).map((id, i) => {
            let capture = captures[id];
            const {name , description} = capture;
            return (
                <Dropdown.Item
                    key={i}
                    onClick={() => this.setCapture(id, capture)}>{description || name}
                </Dropdown.Item>
            )
        });

        let services_list = services.map((stream,i) => {
            return (<Service key={i} index={i} service={services[i]} id={id}
                             saveData={this.saveData} removeRestream={this.delService} addNote={this.addNote} />);
        });

        return(
            <Segment textAlign='center' basic >
                <Label attached='top' size='big' >
                    <Dropdown item text={id ? capture.description: "Select:"}>
                        <Dropdown.Menu>{cap_options}</Dropdown.Menu>
                    </Dropdown>
                </Label>
                <Divider />

                {id === "dante-main" || id === "dante-backup" ?
                    <Table basic='very'>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell></Table.HeaderCell>
                                <Table.HeaderCell />
                                <Table.HeaderCell></Table.HeaderCell>
                                <Table.HeaderCell />
                            </Table.Row>
                        </Table.Header>

                        <Table.Body>
                            <Table.Row>
                                <Table.Cell><b>Dante Mode</b></Table.Cell>
                                <Table.Cell>
                                    <Segment compact>
                                        <Checkbox label='IN' toggle disabled={status === "On"}
                                                  onChange={() => this.setJsonState("in", !captures[id].jsonst.in)} checked={captures[id].jsonst.in} />
                                    </Segment>
                                </Table.Cell>
                                <Table.Cell>
                                    <Segment compact>
                                        <Checkbox label='OUT' toggle disabled={status === "On"}
                                                  onChange={() => this.setJsonState("out", !captures[id].jsonst.out)} checked={captures[id].jsonst.out} />
                                    </Segment>
                                </Table.Cell>
                            </Table.Row>
                        </Table.Body>
                    </Table>
                    : null}

                {services_list}


                {!id ? null :
                    <Message className='or_buttons'>
                        <Menu fluid secondary text>
                            <Menu.Item>
                                <Button.Group>
                                    <Button positive
                                            onClick={this.startEncoder}>Start</Button>
                                    <Button.Or text='all'/>
                                    <Button negative
                                            onClick={this.stopEncoder}>Stop</Button>
                                </Button.Group>
                            </Menu.Item>

                            {id.match(/^mac-/) ? null :
                                <Menu.Item position='right'>
                                    <List className='stat' size='small'>
                                        <List.Item>
                                            <List.Icon name='microchip'/>
                                            <List.Content
                                                className={parseInt(stat.cpu) > 90 ? "warning" : ""}>
                                                CPU: <b>{stat.cpu}</b></List.Content>
                                        </List.Item>
                                        <List.Item>
                                            <List.Icon name='server'/>
                                            <List.Content
                                                className={parseInt(stat.hdd) > 90 ? "warning" : ""}>
                                                HDD: <b>{stat.hdd}</b></List.Content>
                                        </List.Item>
                                        <List.Item>
                                            <List.Icon name='thermometer'/>
                                            <List.Content
                                                className={parseInt(stat.temp) > 80 ? "warning" : ""}>
                                                TMP: <b>{stat.temp}</b></List.Content>
                                        </List.Item>
                                    </List>
                                </Menu.Item>
                            }
                        </Menu>
                    </Message>
                }
            </Segment>
        );
    }
}

export default Captures;
