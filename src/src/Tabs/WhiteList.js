import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import { MdClose as IconClose } from 'react-icons/md';
import DeleteIcon from '@material-ui/icons/Delete';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import CustomCheckbox from '../Components/CustomCheckbox';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@material-ui/core';
import CustomInput from '../Components/CustomInput';
import CustomSelect from '../Components/CustomSelect';
import I18n from '@iobroker/adapter-react/i18n';

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    input_namber: {
        minWidth: 150
    },
    button: {
        marginRight: 20,
        marginBottom: 40,
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top'
    },
    columnSettings: {
        width: '100%',
    },
    table: {
        minWidth: 700,
        '& td': {
            padding: '2px'
        }
    },
    display_none: {
        display: 'none'
    },
    check_box_style: {
        marginLeft: 0,
        marginRight: 0
    },
    mini_table: {
        display: 'none'
    },
    card: {
        padding: '1px',
        margin: '20px 0',
        border: '1px solid',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    '@media screen and (max-width: 1700px)': {
        table: {
            '& th': {
                padding: '2px'
            }
        }
    },
    '@media screen and (max-width: 1280px)': {
        mini_table: {
            display: 'block'
        },
        max_table: {
            display: 'none'
        },
        table: {
            minWidth: 300
        },
        mini_table_select: {
            minWidth: 185
        }
    }
});
const baseObj = {
    "user": "admin",
    "object": {
        "read": true,
        "list": true,
        "write": true,
        "delete": true
    },
    "state": {
        "read": true,
        "list": true,
        "write": true,
        "create": true,
        "delete": true
    },
    "file": {
        "read": true,
        "list": true,
        "write": true,
        "create": true,
        "delete": true
    }
}
class WhiteList extends Component {
    constructor(props) {
        super(props);
        this.state = {
            inAction: false,
            toast: '',
            isInstanceAlive: false,
            errorWithPercent: false
        };
        const { socket, instance, adapterName } = this.props;
        socket.getState(`system.adapter.${adapterName}.${instance}.alive`).then(state =>
            this.setState({ isInstanceAlive: state && state.val }));
    }

    componentDidMount() {
        const { socket, instance, adapterName } = this.props;
        socket.subscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    componentWillUnmount() {
        const { socket, instance, adapterName } = this.props;
        socket.unsubscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    onAliveChanged = (id, state) => {
        const { instance, adapterName } = this.props;
        if (id === `system.adapter.${adapterName}.${instance}.alive`) {
            this.setState({ isInstanceAlive: state && state.val });
        }
    };

    renderToast() {
        const { classes } = this.props;
        const { toast } = this.state;
        if (!toast) return null;
        return (
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={true}
                autoHideDuration={6000}
                onClose={() => this.setState({ toast: '' })}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                message={<span id="message-id">{toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        className={classes.close}
                        onClick={() => this.setState({ toast: '' })}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />);
    }

    tableSelect(el, style) {
        const { classes, native, onChange } = this.props;
        const { whiteListSettings } = native;
        if (el === 'default') {
            return whiteListSettings[el].user
        }
        return <CustomSelect
            table
            value={whiteListSettings[el].user}
            options={[{ title: 'auth', value: 'auth' }, { title: 'admin', value: 'admin' },]}
            native={native}
            style={style}
            className={classes.mini_table_select}
            onChange={(e) => {
                const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                newObj[el].user = e;
                onChange(`whiteListSettings`, newObj);
            }}
        />
    }

    tableInput(el, style) {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;
        if (el === 'default') {
            return el
        }
        return <CustomInput
            table
            value={el}
            style={style}
            onChange={(e) => {
                const copyObj = JSON.parse(JSON.stringify(whiteListSettings));
                let newObj = {};
                Object.keys(copyObj).forEach(keyObj => {
                    if (keyObj === el) {
                        newObj[e] = copyObj[keyObj];
                    } else {
                        newObj[keyObj] = copyObj[keyObj];
                    }
                });
                onChange(`whiteListSettings`, newObj);
            }}
        />
    }

    buttonAdd() {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;
        return <IconButton color="primary" onClick={() => {
            let newObj = JSON.parse(JSON.stringify(whiteListSettings));
            let number = 1;
            let newKey = '192.168.0.1';
            const addProperty = () => {
                if (Object.keys(newObj).find(keysearch => keysearch === newKey)) {
                    newKey = `192.168.0.${number}`;
                    number = number + 1;
                    addProperty();
                }
            }
            addProperty();
            newObj = Object.assign({ [newKey]: baseObj }, newObj);
            onChange(`whiteListSettings`, newObj);
        }}>
            <AddCircleIcon />
        </IconButton>
    }

    buttonRemove(el) {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;
        return <IconButton color="primary" onClick={() => {
            const copyObj = JSON.parse(JSON.stringify(whiteListSettings));
            delete copyObj[el]
            onChange(`whiteListSettings`, copyObj);
        }} style={el === 'default' ? { display: 'none' } : null} aria-label="delete">
            <DeleteIcon />
        </IconButton>
    }

    render() {
        const { classes, native, onChange } = this.props;
        const { whiteListSettings } = native;
        const tableHeadArr = ['to_read', 'list', 'write', 'delete', 'to_read', 'list', 'write', 'to_create', 'delete', 'to_read', 'list', 'write', 'to_create', 'delete'];
        return <form className={classes.tab}>
            <div style={{ position: 'relative' }} className={`${classes.column} ${classes.columnSettings}`}>
                <div>
                    <CustomCheckbox
                        title='included'
                        attr='whiteListEnabled'
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <div className={native['whiteListEnabled'] ? null : classes.display_none}>
                    <TableContainer style={{ overflowX: 'visible' }} component={Paper}>
                        <Table className={`${classes.table} ${classes.max_table}`} aria-label="spanning table">
                            <TableHead>
                                <TableRow>
                                    <TableCell col align="center" rowSpan={2}>
                                        {this.buttonAdd()}
                                    </TableCell>
                                    <TableCell col align="center" rowSpan={2}>
                                        IP</TableCell>
                                    <TableCell align="center" rowSpan={2}>
                                        {I18n.t('user')}</TableCell>
                                    <TableCell align="center" colSpan={4}>
                                        {I18n.t('object')}</TableCell>
                                    <TableCell align="center" colSpan={5}>
                                        {I18n.t('status')}</TableCell>
                                    <TableCell align="center" colSpan={5}>
                                        {I18n.t('file')}</TableCell>
                                </TableRow>
                                <TableRow>
                                    {tableHeadArr.map((el, index) => (<TableCell key={`${el}_${index}`} align="center">
                                        {I18n.t(el)}</TableCell>))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.keys(whiteListSettings).map((el, index) => {
                                    return <TableRow key={`${index}_max`}>
                                        <TableCell style={{ background: '#dcdcdc', borderBottom: '1px solid #afafaf' }}>
                                            {this.buttonRemove(el)}
                                        </TableCell>
                                        <TableCell style={{ background: '#dcdcdc', borderBottom: '1px solid #afafaf' }}>
                                            {this.tableInput(el, { marginTop: -1, minWidth: 150 })}
                                        </TableCell>
                                        <TableCell style={{ background: '#dcdcdc', borderBottom: '1px solid #afafaf' }}>
                                            {this.tableSelect(el, { marginTop: -1 })}
                                        </TableCell>
                                        {['object', 'state', 'file'].map((elProperty, indexProperty) => (<>
                                            {Object.keys(whiteListSettings[el][elProperty]).map((attr, index) =>
                                                <TableCell style={{ background: indexProperty % 2 ? '#dcdcdc' : null, borderBottom: indexProperty % 2 ? '1px solid #afafaf' : null }} key={`object_${attr}`} align="center">
                                                    <CustomCheckbox
                                                        table
                                                        checked={whiteListSettings[el][elProperty][attr]}
                                                        attr={attr}
                                                        native={native}
                                                        className={classes.check_box_style}
                                                        onChange={(e) => {
                                                            const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                                                            newObj[el][elProperty][attr] = e;
                                                            onChange(`whiteListSettings`, newObj);
                                                        }}
                                                    />
                                                </TableCell>)}</>))}
                                    </TableRow>
                                })}
                            </TableBody>
                        </Table>
                        <div className={classes.mini_table}>
                            <div style={{ position: 'sticky', top: -10, left: 12, background: 'white', zIndex: 22, borderBottom: '1px solid' }}>
                                {this.buttonAdd()}
                            </div>
                            <div>
                                {Object.keys(whiteListSettings).map((el, index) => {
                                    return <div
                                        key={`${index}_wrapper`}
                                        className={classes.card}
                                        style={{ background: index % 2 ? '#efefef' : null }}>
                                        <div style={{ width: 'fit-content' }}>
                                            <div>
                                                {this.buttonRemove(el)}
                                            </div>
                                            <div>IP:
                                            {this.tableInput(el, { marginTop: -5, minWidth: 150, marginLeft: 5 })}
                                            </div>
                                            <div>{I18n.t('user')}:
                                        {this.tableSelect(el, { marginTop: -10, marginLeft: 5 })}
                                            </div>
                                        </div>
                                        {['object', 'state', 'file'].map((element, indexEl) => {
                                            let newTableHeadArr = [...tableHeadArr].splice(indexEl === 0 ? 0 : 4, indexEl === 0 ? 4 : 5)
                                            return <Table key={`${indexEl}_mini`} className={classes.table} aria-label="spanning table">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell style={{ background: '#bbbbbb' }} align="center" colSpan={Object.keys(whiteListSettings[el][element]).length}>
                                                            {I18n.t(['object', 'status', 'file'][indexEl])}</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        {newTableHeadArr.map((elhed, ind) => (<TableCell key={`${elhed}_${ind}_mini`} align="center">
                                                            {I18n.t(elhed)}</TableCell>))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    <TableRow>
                                                        {Object.keys(whiteListSettings[el][element]).map((attr) =>
                                                            <TableCell key={`${element}_${attr}_mini`} align="center">
                                                                <CustomCheckbox
                                                                    table
                                                                    checked={whiteListSettings[el][element][attr]}
                                                                    attr={attr}
                                                                    native={native}
                                                                    className={classes.check_box_style}
                                                                    onChange={(e) => {
                                                                        const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                                                                        newObj[el][element][attr] = e;
                                                                        onChange(`whiteListSettings`, newObj);
                                                                    }}
                                                                />
                                                            </TableCell>)}
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        })}</div>
                                })}
                            </div>
                        </div>
                    </TableContainer>
                </div>
            </div>
            {this.renderToast()}
        </form>;
    }
}

WhiteList.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    changed: PropTypes.bool,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(WhiteList);
