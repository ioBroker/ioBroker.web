import React from 'react';
import PropTypes from 'prop-types';

import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

const CustomModal = ({
    open, close, children, titleButton, titleButton2, buttonClick,
}) => <Dialog
    open={open}
    maxWidth="md"
    onClose={close}
    aria-labelledby="alert-dialog-title"
    aria-describedby="alert-dialog-description"
>
    <DialogTitle id="alert-dialog-title">{I18n.t('Warning')}</DialogTitle>
    <DialogContent>
        {children}
    </DialogContent>
    <DialogActions>
        {titleButton && <Button color="grey" variant="contained" onClick={buttonClick}>
            {titleButton}
        </Button>}
        {titleButton2 && <Button variant="contained" onClick={close} color="primary" autoFocus>
            {titleButton2}
        </Button>}
    </DialogActions>
</Dialog>;

CustomModal.defaultProps = {
    open: false,
    buttonClick: () => { },
    close: () => { },
};

CustomModal.propTypes = {
    open: PropTypes.bool,
    close: PropTypes.func,
    children: PropTypes.any,
    titleButton: PropTypes.string,
    titleButton2: PropTypes.string,
    buttonClick: PropTypes.func,
};

export default CustomModal;
