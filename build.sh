#!/bin/sh
cd `dirname "$0"`
# --help, -h   Full list of options.
lib/oui/build -fo public $@ client
