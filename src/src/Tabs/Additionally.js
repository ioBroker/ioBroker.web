import React, { Component } from 'react';
import { withStyles } from '@mui/styles';
import PropTypes from 'prop-types';

import { FormControl, TextField, MenuItem, FormHelperText, InputLabel, Select } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

import CustomCheckbox from '../Components/CustomCheckbox';

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%',
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20,
    },
    columnSettings: {
        width: 'calc(100% - 10px)',
    },
    fontSize: {
        '@media screen and (max-width: 460px)': {
            '& > *': {
                fontSize: '3.2vw',
            },
        },
    },
});
const LANGUAGES = [
    {
        value: '',
        label: 'System language',
        translate: true,
    },
    {
        value: 'en',
        label: 'English',
    },
    {
        value: 'de',
        label: 'Deutsch',
    },
    {
        value: 'ru',
        label: 'русский',
    },
    {
        value: 'pt',
        label: 'Portugues',
    },
    {
        value: 'nl',
        label: 'Nederlands',
    },
    {
        value: 'fr',
        label: 'français',
    },
    {
        value: 'it',
        label: 'Italiano',
    },
    {
        value: 'es',
        label: 'Espanol',
    },
    {
        value: 'pl',
        label: 'Polski',
    },
    {
        value: 'uk',
        label: 'Українська мова',
    },
    {
        value: 'zh-ch',
        label: '简体中文',
    }
];

class Additionally extends Component {
    constructor(props) {
        super(props);
        this.state = {
            toast: '',
            ipAddressOptions: [],
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
                        title="disable_extensions"
                        attr="disableExtensions"
                        className={classes.fontSize}
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <div>
                    <CustomCheckbox
                        title="disable_states"
                        attr="disableStates"
                        className={classes.fontSize}
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <div>
                    <CustomCheckbox
                        title="disable_files"
                        attr="disableFilesObjects"
                        className={classes.fontSize}
                        native={native}
                        onChange={onChange}
                    />
                </div>
                {!native.disableFilesObjects ? <div>
                    <CustomCheckbox
                        title="show_folders"
                        attr="showFolderIndex"
                        className={classes.fontSize}
                        native={native}
                        onChange={onChange}
                    />
                </div> : null}
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
                <h4>
                    {I18n.t('Cache options')}
                </h4>
                <div>
                    <TextField
                        variant="standard"
                        value={native.staticAssetCacheMaxAge}
                        onChange={async e => await onChange('staticAssetCacheMaxAge', e.target.value)}
                        label={I18n.t('staticAssetCacheMaxAge')}
                        helperText={I18n.t('in seconds')}
                    />
                </div>
                <h4>
                    {I18n.t('Language')}
                </h4>
                <div>
                    <FormControl variant="standard" style={{ width: 250 }}>
                        <InputLabel>{I18n.t('Overload system language')}</InputLabel>
                        <Select
                            value={native.language || ''}
                            label={I18n.t('Overload system language')}
                            onChange={async e => await onChange('language', e.target.value)}
                        >
                            {LANGUAGES.map(item => <MenuItem key={item.value} value={item.value}>{item.translate ? I18n.t(item.label) : item.label}</MenuItem>)}
                        </Select>
                        <FormHelperText>{I18n.t('only for this instance')}</FormHelperText>
                    </FormControl>
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
