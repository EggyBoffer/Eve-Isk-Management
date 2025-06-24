cmd=$1
root_dir=..;

packages_dir=$root_dir/packages;

getNewVersion() {
  current_version=$(npm pkg get version | tr -d '"')
  IFS="." read -r major minor patch <<< "$current_version";
  new_minor=$((minor+1))
  new_version="$major.$new_minor.0";
  echo "$new_version";
}

if [ "$cmd" == "getNewVersion" ]; then
  getNewVersion;
  exit 0;
fi