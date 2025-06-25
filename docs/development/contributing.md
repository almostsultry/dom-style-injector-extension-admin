# Contributing to the D365 Style Injector

We welcome contributions to this project. Please follow these guidelines to ensure a smooth development process.

## Development Workflow

1. **Create a Branch**: All new features or bug fixes should be done on a separate branch. Branch off from `main`.

    ```bash
    # Example for a new feature
    git checkout -b feature/my-new-feature

    # Example for a bug fix
    git checkout -b fix/bug-in-popup
    ```

2. **Local Development**: Run the `dev` command to start the Webpack watcher.

    ```bash
    npm run dev
    ```

    As you make changes to files in the `/src` directory, Webpack will automatically re-bundle the output into the `/dist` directory. You will need to reload the extension in your browser to see the changes.

3. **Code Style & Quality**: We use ESLint for linting and Prettier for code formatting.
    - Run `npm run lint` to check for code quality issues.
    - Run `npm run format` to automatically format your code before committing.

4. **Commit Your Changes**: Make small, logical commits with clear messages.

5. **Create a Pull Request**: Once your feature or fix is complete, push your branch to the remote and open a Pull Request against the `main` branch. Provide a clear description of the changes you have made.

## Project Structure

- **/src/**: Contains all source code for the extension.
  - **/src/popup/**: Contains the HTML, CSS, and JS for the extension's popup UI.
  - **/src/scripts/**: Contains the background service worker and content scripts.
  - **/src/assets/**: Contains static assets like icons.
- **/build/**: Contains the Webpack configuration and related build scripts.
- **/dist/**: Contains the compiled, bundled output of the extension. **This directory is generated automatically. Do not edit files in this directory directly.**
- **/tests/**: Contains all unit and end-to-end tests.
