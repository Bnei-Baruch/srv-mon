import React, {Component} from 'react'
import {Checkbox, Divider, Segment, Label, Dropdown, Message, Button, List, Table, Dimmer, Loader} from 'semantic-ui-react'
import {streamFetcher} from "../shared/tools";


class Workflow extends Component {

    state = {
        workflow: {},
        id: "",
        ival: null,
        sval: null,
        files: [],
        progress: "",
        status: "",
        selected_file: "",
        stat: {cpu: "", hdd: "", temp: ""}

    };

    componentDidMount() {
        const {id, workflows} = this.props;
        if(id)
            this.setWorkflow(id, workflows[id]);
    };

    componentWillUnmount() {
        clearInterval(this.state.ival);
        clearInterval(this.state.sval);
    };

    setWorkflow = (id, workflow) => {
        console.log(":: Set workflow: ",workflow);
        this.setState({id, workflow});
        this.getFiles(workflow);
        this.statTimer(workflow);
        this.checkStatus(workflow);
        if(id !== this.props.id)
            this.props.idState("workflow_id", id);
    };

    setJsonState = (key, value) => {
        let {workflow, id} = this.state;
        workflow.jsonst[key] = value;
        this.props.jsonState("workflows", {[id]: workflow}, id);
    };

    checkStatus = (workflow) => {
        let req = {"req":"wfstat", "id":"status"};
        streamFetcher(workflow.ip, `workflow`, req,  (data) => {
            let status = data.jsonst.workflow;
            console.log(":: Got Workflow status: ",status);
            this.setState({status});
            if(status === "On") {
                this.runTimer()
            } else {
                clearInterval(this.state.ival);
                this.setState({progress: "", ival: null});
            }
        });
    };

    runTimer = () => {
        if(this.state.ival) {
            clearInterval(this.state.ival);
            this.setState({ival: null});
        }
        let ival = setInterval(() => {
            const {workflow} = this.state;
            let req = {"req": "progress", "id": "workflow"};
            streamFetcher(workflow.ip, `workflow`, req, (data) => {
                let progress = data.jsonst.files[0];
                let status = data.jsonst.status;
                let files = data.jsonst.files;
                console.log(":: Got Workflow progress: ", progress);
                this.setState({progress,status,files});
            });
        }, 1000);
        this.setState({ival});
    };

    getFiles = (workflow) => {
        let req = {"req":"files", "id":"status"};
        streamFetcher(workflow.ip, `workflow`, req,  (data) => {
            let files = data.jsonst.files || [];
            console.log(":: Got workflow status: ",data);
            this.setState({files});
        });
    };

    sendCommand = (req) => {
        if(window.confirm(`WARNING! We going to - ${req}! Are you sure?`)) {
            this.setState({ival: 0});
            const {workflow} = this.state;
            let request = {req, "id":"status"};
            streamFetcher(workflow.ip, `workflow`, request,  (data) => {
                console.log(":: Got request respond: ",data);
                if(req === "start-workflow") {
                    setTimeout(() => {
                        this.checkStatus(workflow);
                    }, 5000);
                }
            });
        }
    };

    statTimer = (workflow) => {
        this.getStat(workflow);
        if(this.state.sval)
            clearInterval(this.state.sval);
        let sval = setInterval(() => {
            this.getStat(workflow);
        }, 10000);
        this.setState({sval});
    };

    getStat = (workflow) => {
        let req = {"req": "encstat", "id": "workflow"};
        streamFetcher(workflow.ip, `workflow`, req, (data) => {
            let stat = data.jsonst ? data.jsonst : {cpu: "", hdd: "", temp: ""};
            //console.log(":: Got Encoder stat: ", stat);
            this.setState({stat});
        });
    };

    selectFile = (selected_file) => {
        console.log(":: Selected file: ", selected_file);
        const {workflow} = this.state;
        let url = "http://"+workflow.ip+"/backup/captured";
        let source = `${url}/${selected_file}`;
        this.setState({selected_file,source,open: true})
    };

    zoomOut = () => this.setState({ open: false });

    render() {

        const {workflows} = this.props;
        const {workflow, files, id, stat, selected_file, ival, progress} = this.state;
        let l = (<Loader size='mini' active inline/>);

        let wf_options = Object.keys(workflows).map((id, i) => {
            let workflow = workflows[id];
            return (
                <Dropdown.Item
                    key={i}
                    onClick={() => this.setWorkflow(id, workflow)}>{workflow.name}
                </Dropdown.Item>
            )
        });

        let wf_files = files.map((file,i) => {
            let wf_progress = file === progress;
            return (
                <Table.Row active={selected_file === file} disabled={wf_progress} key={i} onClick={() => this.selectFile(file)}>
                    <Table.Cell>{wf_progress ? l : ""}&nbsp;&nbsp;&nbsp;{file}</Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell></Table.Cell>
                </Table.Row>
            )
        })

        return(
            <Segment textAlign='center' color={files === "On" ? 'green' : 'red'} raised>
                <Label attached='top' size='big' >
                    <Dropdown item text={id ? workflow.name: "Select:"}>
                        <Dropdown.Menu>{wf_options}</Dropdown.Menu>
                    </Dropdown>
                </Label>
                <Divider />
                <Table compact='very' selectable basic structured className="admin_table">
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Files</Table.HeaderCell>
                            <Table.HeaderCell></Table.HeaderCell>
                            <Table.HeaderCell></Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>

                    <Dimmer active={this.state.open} onClickOutside={this.zoomOut} page>
                        <video src={this.state.source} type='video/mp4'
                               autoPlay={false}
                               controls={true}
                               muted={false}
                               playsInline={true}/>
                    </Dimmer>

                    <Table.Body>
                        {wf_files}
                    </Table.Body>
                </Table>
                <Message className='or_buttons'>
                    <Button negative disabled={id === ""}
                            onClick={() => this.sendCommand("shutdown")}
                    >Shutdown</Button>
                    <Button negative disabled={id === ""}
                            onClick={() => this.sendCommand("restart")}
                    >Restart</Button>
                    <Button negative disabled={id === ""}
                            onClick={() => this.sendCommand("clean")}
                    >Clean</Button>
                    <List className='stat' size='small'>
                        <List.Item>
                            <List.Icon name='microchip' />
                            <List.Content
                                className={parseInt(stat.cpu) > 90 ? "warning" : ""}>
                                CPU: <b>{stat.cpu}</b></List.Content>
                        </List.Item>
                        <List.Item>
                            <List.Icon name='server' />
                            <List.Content
                                className={parseInt(stat.hdd) > 90 ? "warning" : ""}>
                                HDD: <b>{stat.hdd}</b></List.Content>
                        </List.Item>
                        <List.Item>
                            <List.Icon name='thermometer' />
                            <List.Content
                                className={parseInt(stat.temp) > 80 ? "warning" : ""}>
                                TMP: <b>{stat.temp}</b></List.Content>
                        </List.Item>
                    </List>
                    <Button positive disabled={files.length === 0 || id === "" || ival !== null}
                            onClick={() => this.sendCommand("start-workflow")}
                    >{progress ? "Process..." : "Workflow"}</Button>
                </Message>

            </Segment>
        );
    }
}

export default Workflow;