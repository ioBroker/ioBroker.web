import React, { Component } from 'react';
import { withStyles } from '@mui/styles';
import PropTypes from 'prop-types';

import I18n from '@iobroker/adapter-react-v5/i18n';

import CustomCheckbox from '../Components/CustomCheckbox';
import {TextField} from "@mui/material";

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnSettings: {
        width: 'calc(100% - 10px)'
    },
    fontSize: {
        '@media screen and (max-width: 460px)': {
            '& > *': {
                fontSize: '3.2vw',
            }
        }
    }
});

class Additionally extends Component {
    constructor(props) {
        super(props);
        this.state = {
            toast: '',
            ipAddressOptions: []
        };
    }

    render() {
        const { classes, native, onChange } = this.props;
        return <form className={classes.tab}>
            <div className={`${classes.column} ${classes.columnSettings}`}>
                <h4>
                {I18n.t('disable_default')}
                </h4>
                <p>
                {I18n.t('warning_incorrectly')}
                </p>
                <div>
                    <CustomCheckbox
                        title='disable_extensions'
                        attr='disableExtensions'
                        className={classes.fontSize}
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <div style={native['leEnabled'] ? { display: 'block' } : { display: 'none' }}>
                    <CustomCheckbox
                        title='disable_states'
                        attr='disableStates'
                        className={classes.fontSize}
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <div style={native['leEnabled'] ? { display: 'block' } : { display: 'none' }}>
                    <CustomCheckbox
                        title='disable_files'
                        attr='disableFilesObjects'
                        className={classes.fontSize}
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <h4>
                    {I18n.t('Redirect options')}
                </h4>
                <div>
                    <TextField
                        variant="standard"
                        value={native.defaultRedirect || ''}
                        onChange={async e => await onChange('defaultRedirect', e.target.value)}
                        label={I18n.t('defaultRedirect')}
                        helperText={I18n.t('This path will be opened if no path specified')}
                    />
                </div>
            </div>
        </form>;
    }
}

Additionally.propTypes = {
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

export default withStyles(styles)(Additionally);
