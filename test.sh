#!/bin/bash

# Define the path to the Anchor.toml file
ANCHOR_TOML="Anchor.toml"

# Define the base test command
BASE_TEST_COMMAND="yarn run ts-mocha -p ./tsconfig.json -t 1000000 'tests/"

# Function to modify the Anchor.toml file
modify_anchor_toml() {
  local test_file=$1
  # Replace the test script line in Anchor.toml
  sed -i.bak "s|test = .*|test = \"$BASE_TEST_COMMAND$test_file'\"|" $ANCHOR_TOML
}

anchor build

# Loop through each .ts file in the tests directory
for test_file in tests/*.ts; do
  echo "Running test file: $test_file"

  # Get the filename without the directory path
  file_name=$(basename $test_file)

  # Modify the Anchor.toml file to set the test script to the current test file
  modify_anchor_toml $file_name

  # Run the anchor test command
  anchor test --skip-build

  # Restore the original Anchor.toml file after each test
  mv $ANCHOR_TOML.bak $ANCHOR_TOML
done

# Restore the original test command in Anchor.toml
modify_anchor_toml "**/*.ts' 'tests/*.ts"

echo "All tests completed."
