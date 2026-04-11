#!/bin/bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 20 --silent
exec npm --prefix packages/bench-ai run dev
