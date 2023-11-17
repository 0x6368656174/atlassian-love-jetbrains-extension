function findDiffFileArticle(articleChildElement: Element) {
  return articleChildElement.closest<HTMLElement>(
    '[data-qa="pr-diff-file-styles"]',
  );
}

function findDiffFileArticleNameDiv(diffFileArticleElement: Element) {
  const result = diffFileArticleElement.previousElementSibling;
  return result instanceof HTMLElement ? result : undefined;
}

function findEditIcon(parentElement: Element) {
  return (
    parentElement
      .querySelector(
        '[d="M4.01095129 11.4162698c-.03460638.1588194.01397015.3242009.1292215.4399418.11525135.1157409.28167627.1662741.44271745.1344265l1.85519694-.3803763-2.04744532-2.0492777-.37969057 1.8552857zm6.67101901-7.13015493C10.5011218 4.10314173 10.2533609 4 9.99468235 4c-.25867857 0-.50643946.10314173-.68728798.28611487L4.55405299 9.03654019l2.40791105 2.41015971 4.75334136-4.75090076c.3795928-.38217768.3795928-.99478477 0-1.37696244l-1.0333351-1.03272183z"]',
      )
      ?.closest("span") ?? undefined
  );
}

function findActionsContainer(fileActionsElement: Element) {
  return fileActionsElement.parentElement;
}

function findCopyPathButton(parentElement: Element) {
  return (
    parentElement
      .querySelector(
        '[d="M5 16V4.992C5 3.892 5.902 3 7.009 3H15v13H5zm2 0h8V5H7v11z"]',
      )
      ?.closest("button") ?? undefined
  );
}

function findButtonIcon(button: Element) {
  return button.firstElementChild;
}

type BranchNames = {
  source: string;
  destination: string;
};

function getBranchNames(): BranchNames | undefined {
  const branches = document.querySelector(
    '[data-qa="pr-branches-and-state-styles"]',
  );
  if (!branches) {
    console.warn("Branches div not found");
    return undefined;
  }

  const spans: NodeListOf<HTMLElement> = branches.querySelectorAll(
    'span[aria-hidden="true"]',
  );
  if (spans.length !== 2) {
    console.warn("Finding branches failed");
    return undefined;
  }

  return {
    source: spans[0].innerText,
    destination: spans[1].innerText,
  };
}

const BITBUCKET_HOST = "https://bitbucket.org/";

function getRepoOrigin(): string | undefined {
  const url = window.location.href;
  if (!url.startsWith(BITBUCKET_HOST)) {
    console.warn(
      `The URL of the PR page is not started from ${BITBUCKET_HOST}`,
    );
    return undefined;
  }

  const path = url.slice(BITBUCKET_HOST.length);
  const pathArray = path.split("/");
  if (pathArray.length < 2) {
    console.warn(
      "The URL of the PR page doesn't have organization or repository",
    );
    return undefined;
  }
  const organization = pathArray[0];
  const repository = pathArray[1];

  return `git@bitbucket.org:${organization}/${repository}.git`;
}

const CNG_PREFIX = "chg-";

function addButtons(
  fileActionsElement: HTMLElement,
  repoOrigin: string,
  branchNames: BranchNames,
): void {
  const diffFileArticleElement = findDiffFileArticle(fileActionsElement);
  if (!diffFileArticleElement) {
    console.warn("Not found parent article for file actions node");
    return;
  }

  // Only edited files are supported.
  // Unfortunately, it's not easy to find an original and new file path when file was moved.
  const isEdit = !!findEditIcon(diffFileArticleElement);
  if (!isEdit) {
    return;
  }

  const nameDiv = findDiffFileArticleNameDiv(diffFileArticleElement);
  if (!nameDiv) {
    console.warn("Not found name div for file actions node");
    return;
  }
  const fileNameId = nameDiv.id;
  if (!fileNameId.startsWith(CNG_PREFIX)) {
    console.warn(
      "Id in name div for file action node not start from chg-packages",
    );
    return;
  }
  const fileName = fileNameId.slice(CNG_PREFIX.length);

  const actionsContainer = findActionsContainer(fileActionsElement);
  if (!actionsContainer) {
    console.warn("Not found parent actions container for file actions node");
    return;
  }

  const link = document.createElement("a");
  link.innerText = "Open in IntelliJ IDEA";
  link.href = `jetbrains://idea/navigate/diff?origin=${repoOrigin}&revision_left=${branchNames.source}&revision_right=${branchNames.destination}&path_left=${fileName}&path_right=${fileName}`;
  link.addEventListener("click", (event) => event.stopPropagation());

  const copyPathButton = findCopyPathButton(diffFileArticleElement);
  if (copyPathButton) {
    link.setAttribute("class", copyPathButton.getAttribute("class") ?? "");

    const buttonIcon = findButtonIcon(copyPathButton);
    if (buttonIcon) {
      const iconSrc = chrome.runtime.getURL("jetbrains-icon.png");
      const iconImg = document.createElement("img");
      iconImg.src = iconSrc;
      iconImg.alt = "Open diff in IntelliJ IDEA";
      iconImg.width = 24;
      iconImg.height = 24;
      iconImg.setAttribute("class", buttonIcon.getAttribute("class") ?? "");

      link.insertBefore(iconImg, link.firstChild);
    }
  }

  actionsContainer.insertBefore(link, actionsContainer.firstChild);
}

let branchNames: BranchNames | undefined = undefined;
const repoOrigin = getRepoOrigin();

const mutationObserver = new MutationObserver((mutationList) => {
  if (!branchNames) {
    branchNames = getBranchNames();
  }
  if (!branchNames || !repoOrigin) {
    return;
  }

  for (const mutation of mutationList) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) {
        const fileHeaderActions: NodeListOf<HTMLElement> =
          node.querySelectorAll('[data-qa="bk-file__actions"]');

        for (const fileHeader of fileHeaderActions) {
          addButtons(fileHeader, repoOrigin, branchNames);
        }
      }
    }
  }
});

if (!repoOrigin) {
  console.warn("The PR origin not found");
} else {
  mutationObserver.observe(document, {
    subtree: true,
    childList: true,
  });
}
