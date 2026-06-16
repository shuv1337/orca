cask "orca@rc" do
  arch arm: "arm64", intel: "x64"

  version "1.4.36-rc.3"
  sha256 arm:   "563b6b14323fc9d5489299c82442d514bc12cabffc9d06d3964ed572af4b3955",
         intel: "457088c7021f07de1a419197f7b2bd00092741ad4727d4fef3d86af38a6831e7"

  url "https://github.com/shuv1337/orca/releases/download/v#{version}/orca-macos-#{arch}.dmg",
      verified: "github.com/shuv1337/orca/"
  name "shuvorca RC"
  desc "IDE for orchestrating AI coding agents across terminals and worktrees"
  homepage "https://github.com/shuv1337/orca"

  livecheck do
    url "https://github.com/shuv1337/orca"
    regex(/^v?(\d+(?:\.\d+)+-rc\.\d+)$/i)
    strategy :github_releases do |json, regex|
      json.map do |release|
        next if release["draft"]
        next unless release["prerelease"]

        match = release["tag_name"]&.match(regex)
        next if match.blank?

        match[1]
      end
    end
  end

  # Why: RC installs should follow Orca's prerelease-aware updater instead of
  # waiting for Homebrew metadata churn between frequent release candidates.
  auto_updates true
  conflicts_with cask: "orca"
  depends_on macos: :big_sur

  # Why: productName is now shuvorca, so the bundle is shuvorca.app (executable
  # stays Orca, appId stays com.stablyai.orca — D7, ADR-0001), which is why the
  # zap paths below still reference com.stablyai.orca.
  app "shuvorca.app"

  # Why: Orca writes user data under ~/.orca (worktrees, agent state) and
  # Electron's standard userData directories. Zap removes everything the app
  # creates during normal use so `brew uninstall --zap` is a clean slate.
  zap trash: [
    "~/.orca",
    "~/Library/Application Support/Orca",
    "~/Library/Caches/com.stablyai.orca",
    "~/Library/Caches/com.stablyai.orca.ShipIt",
    "~/Library/HTTPStorages/com.stablyai.orca",
    "~/Library/Preferences/com.stablyai.orca.plist",
    "~/Library/Saved Application State/com.stablyai.orca.savedState",
  ]
end
