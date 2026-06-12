{ pkgs, ... }:
{
  # Which nixpkgs channel to use.
  channel = "stable-23.11"; # Or "unstable"
  # Use https://search.nixos.org/packages to find packages.
  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.npm
  ];
  # Sets environment variables in the workspace.
  env = {};
  # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id" for the ID.
  extensions = [];
  # Enable previews and customize configuration
  previews = {
    enable = true;
    server = {
      # The command to run the web server. This is required.
      command = "npm run preview";
      # The port that the web server will listen on. Default is 3000.
      port = 3000;
      # The directory to serve static files from. This is optional.
      publicDir = "./";
    };
  };

  # What to run when your workspace starts up. It's recommended to start your custom web server here.
  start = {
    # The command to run when the workspace starts.
    command = "npm install && npm start";
  };
}
