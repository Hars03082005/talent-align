export const resources: Record<string, { task: string; proof: string; url: string; label: string }> = {
  python: { task: 'Build a script that cleans a public CSV and writes a reproducible summary.', proof: 'Commit the script, a sample input, and three automated tests.', url: 'https://docs.python.org/3/tutorial/', label: 'Python tutorial' },
  sql: { task: 'Load a public dataset into PostgreSQL and answer five questions using joins, CTEs, and window functions.', proof: 'Publish the schema and runnable queries with expected outputs.', url: 'https://www.postgresql.org/docs/current/tutorial.html', label: 'PostgreSQL tutorial' },
  typescript: { task: 'Convert an existing JavaScript feature to TypeScript and validate the data entering it.', proof: 'Enable strict mode and include a test for an invalid response.', url: 'https://www.typescriptlang.org/docs/handbook/intro.html', label: 'TypeScript handbook' },
  docker: { task: 'Containerize a project with a Dockerfile and run its tests in a clean container.', proof: 'Include the image build and run commands in your README.', url: 'https://docs.docker.com/get-started/', label: 'Docker getting started' },
  kubernetes: { task: 'Deploy a container to a local Kubernetes cluster with readiness and liveness probes.', proof: 'Commit the manifests and record a successful rolling update.', url: 'https://kubernetes.io/docs/tutorials/', label: 'Kubernetes tutorials' },
  react: { task: 'Build a searchable list from an API with loading, empty, and error states.', proof: 'Deploy the interface and test a full search interaction.', url: 'https://react.dev/learn', label: 'React Learn' },
  'machine learning': { task: 'Train a baseline model on a public dataset with a held-out test set and explicit evaluation metrics.', proof: 'Commit a reproducible notebook, comparison table, and error analysis.', url: 'https://scikit-learn.org/stable/tutorial/index.html', label: 'Scikit-learn tutorials' },
  aws: { task: 'Deploy a small service on AWS and document its access controls and cost assumptions.', proof: 'Publish an architecture diagram and a repeatable deployment guide.', url: 'https://aws.amazon.com/getting-started/', label: 'AWS getting started' },
  java: { task: 'Build a small Java service with typed request validation and tests for boundary cases.', proof: 'Publish build commands and the test results in your README.', url: 'https://dev.java/learn/', label: 'Learn Java' },
  'c++': { task: 'Implement a command-line data processor and test malformed input and large files.', proof: 'Commit the build configuration, tests, and one benchmark.', url: 'https://en.cppreference.com/', label: 'C++ reference' },
  linux: { task: 'Configure a service on a local Linux VM with a restricted service account and readable logs.', proof: 'Document startup, recovery, and log inspection commands.', url: 'https://www.kernel.org/doc/html/latest/', label: 'Linux documentation' },
  git: { task: 'Run a small project through a feature branch, review, merge, and versioned release.', proof: 'Link the pull request, review notes, and tagged release.', url: 'https://git-scm.com/docs/gittutorial', label: 'Git tutorial' },
  terraform: { task: 'Provision a small test environment with a reusable Terraform module.', proof: 'Commit the configuration and document plan, apply, and teardown.', url: 'https://developer.hashicorp.com/terraform/tutorials', label: 'Terraform tutorials' },
};

export function practiceFor(skill: string) {
  return resources[skill.toLowerCase()] ?? {
    task: 'Find a requirement in the target listing that involves ' + skill + ', then build a small example that demonstrates it.',
    proof: 'Publish a runnable example, include one test, and explain what you built and how you verified it.',
    url: '', label: '',
  };
}
