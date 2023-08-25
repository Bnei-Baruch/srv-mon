import React, {Component} from 'react'
import {Divider, Table, Segment, Label, Dropdown, Message, Button, List, Menu, Checkbox, Select, Popup} from 'semantic-ui-react'
import {getService, toHms, putData, getRooms, cloneStream, destroyStream} from "../shared/tools";
import {initJanus, destroyJanus, getStats} from "../shared/media";
import Service from "./Service";
import mqtt from "../shared/mqtt";


class Encoders extends Component {

    state = {
        encoder: {},
        feed_rtcp: {},
        id: "",
        room: {"room":1051,"janus":"gxy8","description":"Test Room","questions":false,"num_users":0,"users":null,"region":"","extra":null},
        rooms: [{"room":1051,"janus":"gxy8","description":"Test Room","questions":false,"num_users":0,"users":null,"region":"","extra":null}],
        ival: null,
        services: [],
        status: "",
        stat: {cpu: "", hdd: "", temp: ""},
        preview: false
    };

    componentDidMount() {
        this.props.onRef(this)
        const {id,encoders} = this.props;
        if(id && id !== "galaxy-test") {
            this.setEncoder(id, encoders[id]);
        }
    };

    componentWillUnmount() {
        this.props.onRef(undefined)
        clearInterval(this.state.ival);
        destroyJanus()
        destroyStream()
    };

    onMqttMessage = (message, topic) => {
        let services = message.data;
        const local = true
        const src = local ? topic.split("/")[3] : topic.split("/")[4];
        if(services && this.state.id === src) {
            for(let i=0; i<services.length; i++) {
                services[i].out_time = toHms(services[i].runtime);
            }
            this.setState({services});
        } else if (topic === "janus/live/from-janus-admin") {
            const data = message;
            const m0 = data.info.webrtc.media[0];
            const m1 = data.info.webrtc.media[1];
            let video = null;
            let audio = null;
            if (m0 && m1) {
                audio = data.info.webrtc.media[0].rtcp.main;
                video = data.info.webrtc.media[1].rtcp.main;
            } else if (m0.type === "audio") {
                audio = data.info.webrtc.media[0].rtcp.main;
            } else if (m0.type === "video") {
                video = data.info.webrtc.media[0].rtcp.main;
            }
            this.setState({feed_rtcp: {video, audio}});
        }
    };

    setEncoder = (id, encoder) => {
        console.log(":: Set encoder: ",encoder);
        if(id === "galaxy-test") {
            getRooms(data => {
                let rooms = data.rooms.filter(r => r.janus === "gxy8");
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
        const cmd = `janus.py --play-from video.mp4 --room ${room.room} https://gxy8.kli.one/janusgxy`;
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

    switchPreview = () => {
        this.setState({preview: !this.state.preview}, () => {
            if(this.state.preview) {
                initJanus(this.props.user, "live", (track, mid, on) => {
                    let stream = new MediaStream([track]);
                    if (track.kind === "video" && on) {
                        let remotevideo = this.refs["pv" + 1];
                        if (remotevideo) remotevideo.srcObject = stream;
                    }
                    if (track.kind === "audio" && on) {
                        let remoteaudio = this.refs["pa" + 1];
                        if (remoteaudio) remoteaudio.srcObject = stream;
                        cloneStream(stream, 1);
                    }
                })
            } else {
                destroyJanus()
                destroyStream()
            }
        });
    }

    getStat = () => {
        const {id} = this.state;
        mqtt.send("status", false, "exec/service/" + id);
    };

    getEncoderStats = () => {
        getStats()
    }

    render() {

        const {encoders} = this.props;
        const {encoder, id, status, feed_rtcp, services, room, rooms, preview} = this.state;

        let rooms_options = rooms.map((r, i) => {
            return({ key: i, text: r.description, value: r });
        });

        let enc_options = Object.keys(encoders).map((id, i) => {
            let encoder = encoders[id];
            const {name , description} = encoder;
            if(name === "Galaxy-Test") return null
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

        const infoPopup = (
            <Popup
                trigger={<Button color="blue" icon="info" onClick={this.getEncoderStats} />}
                position="bottom left"
                content={
                    <List as="ul">
                        {feed_rtcp.video ? (
                            <List.Item as="li">
                                Video
                                <List.List as="ul">
                                    <List.Item as="li">in-link-quality: {feed_rtcp.video["in-link-quality"]}</List.Item>
                                    <List.Item as="li">in-media-link-quality: {feed_rtcp.video["in-media-link-quality"]}</List.Item>
                                    <List.Item as="li">jitter-local: {feed_rtcp.video["jitter-local"]}</List.Item>
                                    <List.Item as="li">jitter-remote: {feed_rtcp.video["jitter-remote"]}</List.Item>
                                    <List.Item as="li">lost: {feed_rtcp.video["lost"]}</List.Item>
                                </List.List>
                            </List.Item>
                        ) : null}
                        {feed_rtcp.audio ? (
                            <List.Item as="li">
                                Audio
                                <List.List as="ul">
                                    <List.Item as="li">in-link-quality: {feed_rtcp.audio["in-link-quality"]}</List.Item>
                                    <List.Item as="li">in-media-link-quality: {feed_rtcp.audio["in-media-link-quality"]}</List.Item>
                                    <List.Item as="li">jitter-local: {feed_rtcp.audio["jitter-local"]}</List.Item>
                                    <List.Item as="li">jitter-remote: {feed_rtcp.audio["jitter-remote"]}</List.Item>
                                    <List.Item as="li">lost: {feed_rtcp.audio["lost"]}</List.Item>
                                </List.List>
                            </List.Item>
                        ) : null}
                    </List>
                }
                on="click"
                hideOnScroll
            />
        );

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

                            {id === "knasim-record" || id === "knasim-webrtc" ?
                                <Menu.Item>
                                    <Button icon="eye" color={preview ? "green" : "red"}
                                            onClick={this.switchPreview} />
                                    {preview ? infoPopup : null}
                                </Menu.Item>
                                :
                                <Menu.Item>
                                    <Button.Group>
                                        <Button positive
                                                onClick={this.startEncoder}>Start</Button>
                                        <Button.Or text='all'/>
                                        <Button negative
                                                onClick={this.stopEncoder}>Stop</Button>
                                    </Button.Group>
                                </Menu.Item>
                            }

                            {/*{id.match(/^mac-/) ? null :*/}
                            {/*    <Menu.Item position='right'>*/}
                            {/*        <List className='stat' size='small'>*/}
                            {/*            <List.Item>*/}
                            {/*                <List.Icon name='microchip'/>*/}
                            {/*                <List.Content*/}
                            {/*                    className={parseInt(stat.cpu) > 90 ? "warning" : ""}>*/}
                            {/*                    CPU: <b>{stat.cpu}</b></List.Content>*/}
                            {/*            </List.Item>*/}
                            {/*            <List.Item>*/}
                            {/*                <List.Icon name='server'/>*/}
                            {/*                <List.Content*/}
                            {/*                    className={parseInt(stat.hdd) > 90 ? "warning" : ""}>*/}
                            {/*                    HDD: <b>{stat.hdd}</b></List.Content>*/}
                            {/*            </List.Item>*/}
                            {/*            <List.Item>*/}
                            {/*                <List.Icon name='thermometer'/>*/}
                            {/*                <List.Content*/}
                            {/*                    className={parseInt(stat.temp) > 80 ? "warning" : ""}>*/}
                            {/*                    TMP: <b>{stat.temp}</b></List.Content>*/}
                            {/*            </List.Item>*/}
                            {/*        </List>*/}
                            {/*    </Menu.Item>*/}
                            {/*}*/}

                        </Menu>
                    </Message>
                }

                {preview ?
                    <div>
                        <video
                            key="pv1"
                            ref="pv1"
                            id="pv1"
                            width={640}
                            height={360}
                            autoPlay={true}
                            controls={true}
                            muted={true}
                            playsInline={true}
                        />
                        <audio
                            key="pa1"
                            ref="pa1"
                            id="pa1"
                            autoPlay={true}
                            controls={false}
                            muted={true}
                            playsInline={true}
                        />
                        <Message className='vu'>
                            <canvas ref={"canvas" + 1} id={"canvas" + 1} width="630" height="10" />
                        </Message>
                    </div>
                    : null
                }

            </Segment>
        );
    }
}

export default Encoders;
