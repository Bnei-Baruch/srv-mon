import React, {Component} from 'react'
import { Divider, Table, Segment, Label, Dropdown, Select, Message, Button } from 'semantic-ui-react'
import {buffer_options, channels_options, rtcpip_options, streamFetcher, vres_options} from "../shared/tools";


class Decoders extends Component {

    state = {
        decoder: {},
        id: "",
        status: "",
    };

    componentDidMount() {
        const {id,decoders} = this.props;
        if(id)
            this.setDecoder(id, decoders[id]);
    };

    setDecoder = (id, decoder) => {
        console.log(":: Set decoder: ",decoder);
        this.setState({id, decoder});
        let req = {"req":"strstat", "id":"status"};
        streamFetcher(decoder.ip, `decoder`, req,  (data) => {
            let status = data.stdout.replace(/\n/ig, '');
            console.log(":: Got Decoder status: ",status);
            this.setState({status});
        });
        if(id !== this.props.id)
            this.props.idState("decoder_id", id);
    };

    setJsonState = (key, value) => {
        let {decoder, id} = this.state;
        decoder.jsonst[key] = value;
        this.props.jsonState("decoders", {[id]: decoder}, id);
    };

    startDecoder = () => {
        this.setState({status: "On"});
        let {decoder} = this.state;
        let {jsonst} = decoder;
        jsonst.id = "stream";
        jsonst.req = "start";
        streamFetcher(decoder.ip, `decoder`, jsonst,  (data) => {
            //let status = data.stdout.replace(/\n/ig, '');
            console.log(":: Start Decoder status: ",data);
            //TODO: here we need save state to db
        });
    };

    stopDecoder = () => {
        this.setState({status: "Off"});
        let {decoder} = this.state;
        let {jsonst} = decoder;
        jsonst.id = "stream";
        jsonst.req = "stop";
        streamFetcher(decoder.ip, `decoder`, jsonst,  (data) => {
            //let status = data.stdout.replace(/\n/ig, '');
            console.log(":: Stop Decoder status: ",data);
        });
    };

    render() {

        const {decoders} = this.props;
        const {decoder, id, status} = this.state;

        let dec_options = Object.keys(decoders).map((id, i) => {
            let decoder = decoders[id];
            return (
                <Dropdown.Item
                    key={i}
                    onClick={() => this.setDecoder(id, decoder)}>{decoder.name}
                </Dropdown.Item>
            )
        });

        return(
            <Segment textAlign='center' color={status === "On" ? 'green' : 'red'} raised>
                <Label attached='top' size='big' >
                    <Dropdown item text={id ? decoder.name : "Select:"}>
                        <Dropdown.Menu>{dec_options}</Dropdown.Menu>
                    </Dropdown>
                </Label>
                <Divider />

                <Table basic='very' compact='very' collapsing>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell></Table.HeaderCell>
                            <Table.HeaderCell />
                            <Table.HeaderCell></Table.HeaderCell>
                            <Table.HeaderCell />
                            <Table.HeaderCell></Table.HeaderCell>
                            <Table.HeaderCell />
                        </Table.Row>
                    </Table.Header>

                    <Table.Body>
                        <Table.Row>
                            <Table.Cell>Buffer</Table.Cell>
                            <Table.Cell>
                                <Select disabled={!id}
                                        compact options={buffer_options}
                                        value={id ? decoders[id].jsonst.buffer : ""}
                                        onChange={(e, {value}) => this.setJsonState("buffer", value)}
                                />
                            </Table.Cell>
                            <Table.Cell>Format</Table.Cell>
                            <Table.Cell>
                                <Select disabled={!id}
                                        compact options={vres_options}
                                        value={id ? decoders[id].jsonst.vres : ""}
                                        onChange={(e, {value}) => this.setJsonState("vres", value)}
                                />
                            </Table.Cell>
                        </Table.Row>
                        <Table.Row>
                            <Table.Cell>Channels</Table.Cell>
                            <Table.Cell>
                                <Select disabled={!id}
                                        compact options={channels_options}
                                        value={id ? decoders[id].jsonst.channels : ""}
                                        onChange={(e, {value}) => this.setJsonState("channels", value)}
                                />
                            </Table.Cell>
                            <Table.Cell>Encoder</Table.Cell>
                            <Table.Cell>
                                <Select disabled={!id}
                                        options={rtcpip_options}
                                        value={id ? decoders[id].jsonst.rtcpip : ""}
                                        onChange={(e, {value}) => this.setJsonState("rtcpip", value)}
                                />
                            </Table.Cell>
                        </Table.Row>
                    </Table.Body>
                </Table>

                <Message className='or_buttons' >
                    <Button.Group >
                        <Button positive disabled={status !== "Off"}
                        onClick={this.startDecoder}>Start</Button>
                        <Button.Or text='dec' />
                        <Button negative disabled={status !== "On"}
                        onClick={this.stopDecoder}>Stop</Button>
                    </Button.Group>
                </Message>

            </Segment>
        );
    }
}

export default Decoders;