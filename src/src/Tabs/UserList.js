import React, { Component } from 'react';
import { withStyles } from '@mui/styles';
import PropTypes from 'prop-types';

import {
    MenuItem,
    Paper, Select, Checkbox,
} from '@mui/material';

import { TextWithIcon, I18n } from '@iobroker/adapter-react-v5';

import CustomCheckbox from '../Components/CustomCheckbox';
import Toast from '../Components/Toast';

const styles = ({ name }) => ({
    backgroundTheme: {
        background: name === 'dark' ? '#3e3838' : '#dcdcdc',
    },
    tab: {
        width: '100%',
        minHeight: '100%',
    },
    button: {
        marginRight: 20,
        marginBottom: 40,
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
    },
    columnSettings: {
        width: '100%',
    },
    table: {
        minWidth: 700,
        '& td': {
            padding: 2,
        },
    },
    displayNone: {
        display: 'none',
    },
    checkBoxStyle: {
        marginLeft: 0,
        marginRight: 0,
    },
    miniTable: {
        display: 'none',
    },
    card: {
        padding: 1,
        margin: '20px 0',
        border: '1px solid',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    '@media screen and (max-width: 1700px)': {
        table: {
            '& th': {
                padding: 2,
            },
        },
    },
    '@media screen and (max-width: 1280px)': {
        miniTable: {
            display: 'block',
        },
        maxTable: {
            display: 'none',
        },
        table: {
            minWidth: 300,
        },
        miniTableSelect: {
            minWidth: 185,
        },
    },
    warning: {
        color: '#FF4040',
        fontSize: 18,
        display: 'inline-block',
    },
});

class UserList extends Component {
    constructor(props) {
        super(props);
        this.state = {
            toast: '',
            groups: null,
            users: null,
        };
        this.lang = I18n.getLanguage();
    }

    async componentDidMount() {
        const users = await this.props.socket.getUsers();
        const groups = await this.props.socket.getGroups();
        this.setState({ users, groups });
    }

    render() {
        const { classes, native, onChange } = this.props;
        const { userListSettings } = native;
        const { toast } = this.state;

        return <form className={classes.tab}>
            <Toast message={toast} onClose={() => this.setState({ toast: '' })} />
            <div style={{ position: 'relative' }} className={`${classes.column} ${classes.columnSettings}`}>
                <CustomCheckbox
                    title="included"
                    attr="userListEnabled"
                    native={native}
                    onChange={(attr, value) => onChange(attr, value, () => {
                        if (value && !native.userListSettings) {
                            onChange('userListSettings', {
                                accessAsUser: 'system.user.admin',
                                users: ['system.user.admin'],
                                groups: ['system.group.administrator'],
                            });
                        }
                    })}
                />
                {userListSettings && this.state.users ? <div>
                    <div>
                        {I18n.t('Only following users may access web interface as')}
                        <Select
                            style={{ marginLeft: 10, marginRight: 10 }}
                            variant="standard"
                            value={native.userListSettings.accessAsUser || '_'}
                            onChange={e => {
                                const _userListSettings = JSON.parse(JSON.stringify(native.userListSettings));
                                _userListSettings.accessAsUser = e.target.value === '_' || !e.target.value ? '' : e.target.value;
                                onChange('userListSettings', _userListSettings);
                            }}
                            renderValue={item => {
                                if (!item || item === '_') {
                                    return I18n.t('logged in user');
                                }
                                const user = this.state.users.find(_user => _user._id === item);
                                return user ? <TextWithIcon value={user} lang={this.lang} /> : item;
                            }}
                        >
                            <MenuItem value="_">
                                {I18n.t('logged in user')}
                            </MenuItem>
                            {this.state.users.map(user => <MenuItem key={user._id} value={user._id}>
                                <TextWithIcon value={user} lang={this.lang} />
                            </MenuItem>)}
                        </Select>
                        {I18n.t('after authentication')}
                        :
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            width: '100%',
                            maxWidth: 1024,
                            flexDirection: 'row',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                width: 'calc(50% - 20px)',
                                maxWidth: 512,
                                flexDirection: 'column',
                            }}
                        >
                            <div style={{ fontSize: 24, fontWeight: 'bold', marginLeft: 8 }}>
                                {I18n.t('Groups')}
                            </div>
                            {this.state.groups.map(group => <Paper
                                key={group._id}
                                style={{
                                    width: 'calc(100% - 40px)',
                                    margin: 10,
                                    padding: 10,
                                }}
                            >
                                <div style={{ display: 'flex' }}>
                                    <Checkbox
                                        disabled={group._id === 'system.group.administrator'}
                                        onChange={() => {
                                            const _userListSettings = JSON.parse(JSON.stringify(native.userListSettings));
                                            const pos = _userListSettings.groups.indexOf(group._id);
                                            if (pos !== -1) {
                                                _userListSettings.groups.splice(pos, 1);
                                            } else {
                                                _userListSettings.groups.push(group._id);
                                                _userListSettings.groups.sort();
                                            }
                                            onChange('userListSettings', _userListSettings);
                                        }}
                                        checked={native.userListSettings.groups.includes(group._id)}
                                    />
                                    <TextWithIcon value={group} lang={this.lang} />
                                </div>
                                <div style={{ display: 'flex', marginLeft: 12 }}>
                                    <span style={{ marginRight: 8 }}>{I18n.t('Group members:')}</span>
                                    {group.common.members.map(user => {
                                        const userObj = this.state.users.find(_user => _user._id === user);
                                        if (userObj) {
                                            return <TextWithIcon key={user} value={userObj} lang={this.lang} />;
                                        }
                                        return <span key={user}>{user}</span>;
                                    })}
                                </div>
                            </Paper>)}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                width: 'calc(50% - 20px)',
                                maxWidth: 512,
                                flexDirection: 'column',
                            }}
                        >
                            <div style={{ fontSize: 24, fontWeight: 'bold', marginLeft: 8 }}>
                                {I18n.t('Users')}
                            </div>
                            {this.state.users.map(user => {
                                const inGroup = !!native.userListSettings.groups.find(groupId => {
                                    const group = this.state.groups.find(_group => _group._id === groupId);
                                    return group && group.common.members.includes(user._id);
                                });

                                return <Paper
                                    key={user._id}
                                    style={{
                                        width: 'calc(100% - 40px)',
                                        margin: 10,
                                        padding: 10,
                                    }}
                                >
                                    <div style={{ display: 'flex' }}>
                                        <Checkbox
                                            disabled={user._id === 'system.user.admin' || inGroup}
                                            onChange={() => {
                                                const _userListSettings = JSON.parse(JSON.stringify(native.userListSettings));
                                                const pos = _userListSettings.users.indexOf(user._id);
                                                if (pos !== -1) {
                                                    _userListSettings.users.splice(pos, 1);
                                                } else {
                                                    _userListSettings.users.push(user._id);
                                                    _userListSettings.users.sort();
                                                }
                                                onChange('userListSettings', _userListSettings);
                                            }}
                                            checked={native.userListSettings.users.includes(user._id) || inGroup}
                                        />
                                        <TextWithIcon value={user} lang={this.lang} />
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            marginLeft: 12,
                                        }}
                                    >
                                        <span style={{ marginRight: 8 }}>{I18n.t('In groups:')}</span>
                                        {this.state.groups.filter(group => group.common.members.includes(user._id)).map(group =>
                                            <TextWithIcon key={group._id} value={group} lang={this.lang} />)}
                                    </div>
                                </Paper>;
                            })}
                        </div>
                    </div>
                </div> : null}
            </div>
        </form>;
    }
}

UserList.propTypes = {
    native: PropTypes.object.isRequired,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(UserList);
