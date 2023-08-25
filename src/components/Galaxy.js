import React, {Component} from 'react'
import {Divider, Table, Segment, Label, Dropdown, Message, Button, List, Menu, Checkbox, Select} from 'semantic-ui-react'
import {getService, toHms, putData, getRooms} from "../shared/tools";
import Service from "./Service";
import mqtt from "../shared/mqtt";


class Galaxy extends Component {

    state = {
        encoder: {},
        id: "galaxy-test",
        room: {"room":1051,"janus":"gxy9","description":"Test Room","questions":false,"num_users":0,"users":null,"region":"","extra":null},
        rooms: [{"room":1051,"janus":"gxy9","description":"Test Room","questions":false,"num_users":0,"users":null,"region":"","extra":null}],
        ival: null,
        services: [],
        status: "",
        stat: {cpu: "", hdd: "", temp: ""}
    };

    componentDidMount() {
        this.props.onRef(this)
        const {encoders} = this.props;
        const id = "galaxy-test";
        this.setEncoder(id, encoders[id]);
    };

    componentWillUnmount() {
        this.props.onRef(undefined)
        clearInterval(this.state.ival);
    };

    onMqttMessage = (message, topic) => {
        //console.debug("[encoders] Message: ", message);
        let services = message.data;
        const local = true
        const src = local ? topic.split("/")[3] : topic.split("/")[4];
        if(services && this.state.id === src) {
            for(let i=0; i<services.length; i++) {
                services[i].out_time = toHms(services[i].runtime);
            }
            this.setState({services});
        }
    };

    setEncoder = (id, encoder) => {
        console.log(":: Set encoder: ",encoder);
        if(id === "galaxy-test") {
            getRooms(data => {
                let rooms = data.rooms.filter(r => r.janus === "gxy9");
                this.setState({rooms})
            });
        }
        this.setState({id, encoder}, () => {
            this.runTimer();
        });
        if(id !== this.props.id)
            this.props.idState("encoder_id", id);
    };

    addService = () => {
        const {encoder, room} = this.state;
        if(!encoder.services) {
            encoder.services = [];
        }
        const id = "janus-" + (encoder.services.length + 1).toString();
        const description = room.description;
        const cmd = `janus.py --play-from video.mp4 --room ${room.room} https://gxy9.kab.sh/janusgxy`;
        const args = cmd.split(" ");
        encoder.services.push({description, id, name: "python3", args});
        this.saveData(encoder)
    };

    delService = (i) => {
        const {encoder} = this.state;
        if(encoder.alive)
            return;
        encoder.services.splice(i, 1);
        this.saveData(encoder)
    };

    addNote = (i, description) => {
        const {encoder} = this.state;
        encoder.services[i].description = description;
        this.saveData(encoder);
    };

    saveData = (props) => {
        const {id} = this.state;
        putData(`streamer/encoders/${id}`, props, (data) => {
            console.log("saveProp callback: ", data);
        });
    };

    setJsonState = (key, value) => {
        let {encoder, id} = this.state;
        encoder.jsonst[key] = value;
        this.props.jsonState("encoders", {[id]: encoder}, id);
    };

    startEncoder = () => {
        let {id} = this.state;
        getService(id + "/start", () => {})
    };

    stopEncoder = () => {
        let {id} = this.state;
        getService(id + "/stop", () => {})
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
    };

    render() {

        const {encoders} = this.props;
        const {encoder, id, status, stat, services, room, rooms} = this.state;

        let rooms_options = rooms.map((r, i) => {
            return({ key: i, text: r.description, value: r });
        });

        let enc_options = Object.keys(encoders).map((id, i) => {
            let encoder = encoders[id];
            const {name , description} = encoder;
            if(name !== "Galaxy-Test" && this.props.shidur_galaxy) return null
            return (
                <Dropdown.Item
                    key={i}
                    onClick={() => this.setEncoder(id, encoder)}>{description || name}
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
                    <Dropdown item text={id ? encoder.description: "Select:"}>
                        <Dropdown.Menu>{enc_options}</Dropdown.Menu>
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
                                              onChange={() => this.setJsonState("in", !encoders[id].jsonst.in)} checked={encoders[id].jsonst.in} />
                                    </Segment>
                                </Table.Cell>
                                <Table.Cell>
                                    <Segment compact>
                                    <Checkbox label='OUT' toggle disabled={status === "On"}
                                              onChange={() => this.setJsonState("out", !encoders[id].jsonst.out)} checked={encoders[id].jsonst.out} />
                                    </Segment>
                                </Table.Cell>
                            </Table.Row>
                        </Table.Body>
                    </Table>
                : null}

                {id === "galaxy-test" ?
                    <div><Divider />
                        <Label size='big' >
                            <Select compact options={rooms_options} value={room} size='big'
                                    onChange={(e, {value}) => this.setState({room: value})} />
                            <Button size='big' color='blue' onClick={this.addService}>Add</Button>
                        </Label>
                        <Divider /></div>
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

export default Galaxy;
