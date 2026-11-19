#!/usr/bin/env python3
"""Exchange two directories atomically on Linux, including nonempty ones."""

import ctypes
import os
import sys

rename = ctypes.CDLL(None, use_errno=True).renameat2
rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
AT_FDCWD, RENAME_EXCHANGE = -100, 2
if rename(AT_FDCWD, os.fsencode(sys.argv[1]), AT_FDCWD, os.fsencode(sys.argv[2]), RENAME_EXCHANGE):
    error = ctypes.get_errno()
    raise OSError(error, os.strerror(error))
